#!/usr/bin/env bash
# Argus VM operations — a thin wrapper around docker-compose.vm.yml, run from
# anywhere inside the repo checkout on the VM:
#
#   ./deploy/vm.sh init               create .env.vm with freshly generated secrets
#   ./deploy/vm.sh preflight          check the box + .env.vm before deploying
#   ./deploy/vm.sh nginx              print the nginx site for API_HOST (pipe to sudo tee)
#   ./deploy/vm.sh up                 pull images, migrate, start, wait for healthy
#   ./deploy/vm.sh status             containers + live memory use vs. caps
#   ./deploy/vm.sh logs [service]     follow logs (default: api)
#   ./deploy/vm.sh user <email> <admin|analyst|viewer>   create / reset an account
#   ./deploy/vm.sh backup [dir]       gzip'd pg_dump (default dir: ./backups)
#   ./deploy/vm.sh rollback <sha>     run images from an earlier commit (one-off)
#   ./deploy/vm.sh verify             check the public endpoint end to end
#   ./deploy/vm.sh down               stop Argus (data volumes kept)
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=${ENV_FILE:-.env.vm}
COMPOSE=(docker compose -f docker-compose.vm.yml --env-file "$ENV_FILE")
ARGUS_CONTAINERS=(argus-kafka argus-redis argus-api argus-generator)
# throwaway client for psql/pg_dump against the managed database — pg_dump must
# be at least the server's major version, so this tracks the newest Postgres
PG_CLIENT_IMAGE=${PG_CLIENT_IMAGE:-postgres:18-alpine}

FAILS=0
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() {
  printf '  \033[31m✗\033[0m %s\n' "$*"
  FAILS=$((FAILS + 1))
}
die() {
  printf '\033[31m✗\033[0m %s\n' "$*" >&2
  exit 1
}

# read KEY from the env file without sourcing it (it holds secrets; sourcing
# would also execute anything in it). Last assignment wins; quotes stripped.
env_get() {
  [[ -f $ENV_FILE ]] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -E "s/^['\"]|['\"]$//g" || true
}

need_env_file() { [[ -f $ENV_FILE ]] || die "$ENV_FILE not found — cp .env.vm.example $ENV_FILE and fill it in"; }

random_hex() { # $1 bytes of CSPRNG output, hex-encoded
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -tx1 -N"$1" /dev/urandom | tr -d ' \n'
  fi
}

# Creates $ENV_FILE from "$ENV_FILE.example" (if missing) and fills every
# secret that's still empty with fresh random hex. Run it ON the machine that
# uses the file, so the secrets are never generated or stored anywhere else.
# Never overwrites a value that's already set — a new AUTH_SECRET logs everyone
# out. (POSTGRES_URL is filled in by hand: its password belongs to the Azure
# database role, not to anything generated here.)
cmd_init() {
  local template="$ENV_FILE.example"
  if [[ ! -f $ENV_FILE ]]; then
    [[ -f $template ]] || die "no $ENV_FILE and no $template to create it from"
    (
      umask 077
      cp "$template" "$ENV_FILE"
    )
    ok "created $ENV_FILE from $template"
  fi
  chmod 600 "$ENV_FILE"

  local key bytes generated=0
  for spec in AUTH_SECRET:32; do
    key=${spec%%:*}
    bytes=${spec##*:}
    grep -qE "^$key=" "$ENV_FILE" || continue # not used by this env file
    if [[ -n $(env_get "$key") ]]; then
      ok "$key already set — kept"
      continue
    fi
    sed -i "s|^$key=.*|$key=$(random_hex "$bytes")|" "$ENV_FILE"
    ok "$key generated ($((bytes * 8))-bit)"
    generated=$((generated + 1))
  done

  local missing=()
  for key in POSTGRES_URL CORS_ORIGIN API_HOST; do
    local value
    value=$(env_get "$key")
    grep -qE "^$key=" "$ENV_FILE" && [[ -z $value || $value == *'<'* ]] && missing+=("$key")
  done
  if ((${#missing[@]} > 0)); then warn "still to fill in by hand: ${missing[*]}"; fi
  ok "$ENV_FILE ready (mode 600, $generated secret(s) generated)"
}

# POSTGRES_URL as libpq (psql/pg_dump) accepts it: Prisma-only query params
# (connection_limit, pool_timeout, …) make libpq reject the whole URI.
libpq_url() {
  env_get POSTGRES_URL | sed -E \
    -e 's/([?&])(connection_limit|pool_timeout|pgbouncer|socket_timeout|schema|statement_cache_size)=[^&]*/\1/g' \
    -e 's/&&+/\&/g' -e 's/\?&/?/' -e 's/[?&]$//'
}

# run a libpq client in a throwaway container; the URL (it carries the password)
# goes in via the environment, not the docker command line
pg_client() {
  docker run --rm -i -e PGURL="$(libpq_url)" "$PG_CLIENT_IMAGE" sh -c "$1"' "$PGURL"'
}

port_owner() { # prints the listener on 127.0.0.1/0.0.0.0:$1, if any
  ss -Hltnp "sport = :$1" 2>/dev/null | head -n1
}

cmd_preflight() {
  echo "Tooling"
  if command -v docker >/dev/null 2>&1; then
    ok "docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '(daemon unreachable?)')"
    if docker compose version >/dev/null 2>&1; then ok "$(docker compose version --short | sed 's/^/compose /')"; else fail "docker compose v2 plugin missing"; fi
  else
    fail "docker not installed"
  fi
  if command -v nginx >/dev/null 2>&1; then ok "nginx present"; else warn "nginx not found — use the bundled Caddy (--profile caddy) instead"; fi
  if command -v certbot >/dev/null 2>&1; then ok "certbot present"; else warn "certbot not found — sudo apt install certbot python3-certbot-nginx"; fi

  echo "Env file ($ENV_FILE)"
  if [[ -f $ENV_FILE ]]; then
    local mode
    mode=$(stat -c %a "$ENV_FILE")
    if [[ $mode == 600 || $mode == 400 ]]; then ok "permissions $mode"; else fail "permissions $mode — holds secrets: chmod 600 $ENV_FILE"; fi
    for key in POSTGRES_URL AUTH_SECRET CORS_ORIGIN API_HOST; do
      local value
      value=$(env_get "$key")
      if [[ -z $value ]]; then
        fail "$key is empty"
      elif [[ $value == *'<'*'>'* ]]; then
        fail "$key still has a <placeholder> from the template"
      else
        ok "$key set"
      fi
    done
    local pg_url
    pg_url=$(env_get POSTGRES_URL)
    if [[ -n $pg_url && ! $pg_url =~ sslmode=(require|verify-ca|verify-full) ]]; then
      fail "POSTGRES_URL must have sslmode=require (or verify-full) — the database is reached over the internet"
    fi
    local secret cors
    secret=$(env_get AUTH_SECRET)
    if [[ -n $secret && ${#secret} -lt 32 ]]; then warn "AUTH_SECRET is ${#secret} chars — use openssl rand -hex 32"; fi
    cors=$(env_get CORS_ORIGIN)
    if [[ $cors == *'*'* ]]; then fail "CORS_ORIGIN must be the dashboard origin(s), not *"; fi
    if [[ -n $cors && $cors != https://* ]]; then warn "CORS_ORIGIN should be https:// (the Vercel URL)"; fi
  else
    fail "$ENV_FILE missing — cp .env.vm.example $ENV_FILE && chmod 600 $ENV_FILE"
  fi

  echo "Ports (127.0.0.1)"
  local api_port gen_port
  api_port=$(env_get API_HOST_PORT)
  gen_port=$(env_get GENERATOR_HOST_PORT)
  for p in "${api_port:-4000}" "${gen_port:-4200}"; do
    local owner
    owner=$(port_owner "$p")
    # docker's own mapping first: `ss -p` only names the owning process for root
    if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E "^argus-(api|generator) .*:$p->" >/dev/null; then
      ok "$p already used by Argus itself"
    elif [[ -z $owner ]]; then
      ok "$p free"
    else
      fail "$p is taken (another app?) — set API_HOST_PORT / GENERATOR_HOST_PORT in $ENV_FILE and use the same ports in the nginx site: $owner"
    fi
  done

  echo "Resources"
  local avail_mb free_gb
  avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  if ((avail_mb >= 1300)); then ok "${avail_mb} MB RAM available"; elif ((avail_mb >= 1000)); then warn "${avail_mb} MB RAM available — tight; Argus typically uses ~0.8–1 GB"; else fail "only ${avail_mb} MB RAM available"; fi
  free_gb=$(df -BG --output=avail / | tail -n1 | tr -dc 0-9)
  if ((free_gb >= 8)); then ok "${free_gb} GB disk free on /"; elif ((free_gb >= 4)); then warn "${free_gb} GB disk free on / — images + data need ~3 GB"; else fail "only ${free_gb} GB disk free on /"; fi

  echo "Network"
  local host
  host=$(env_get API_HOST)
  if [[ -n $host ]]; then
    if getent hosts "$host" >/dev/null; then ok "$host resolves to $(getent hosts "$host" | awk '{print $1}' | head -n1)"; else fail "$host does not resolve (DNS record / Azure DNS label?)"; fi
  fi
  if command -v docker >/dev/null 2>&1; then
    local image
    image=$(env_get ARGUS_API_IMAGE)
    image=${image:-ghcr.io/adiikj/argus-api:latest}
    if docker manifest inspect "$image" >/dev/null 2>&1; then ok "can pull $image"; else fail "cannot pull $image — make the GHCR package public, or docker login ghcr.io (PAT: read:packages)"; fi

    local pg_url
    pg_url=$(env_get POSTGRES_URL)
    if [[ -n $pg_url && $pg_url != *'<'* ]]; then
      local db_out
      # a real login over TLS: proves DNS, the Azure firewall rule for this VM,
      # the role's password and that the database exists — all in one go
      if db_out=$(pg_client 'psql -tA -v ON_ERROR_STOP=1 -c "select current_user, current_database(), current_setting('"'"'server_version'"'"'), (select ssl from pg_stat_ssl where pid = pg_backend_pid())" ' 2>&1); then
        IFS='|' read -r db_user db_name db_version db_ssl <<<"$(tr -d '\r' <<<"$db_out" | tail -n1)"
        ok "Postgres login works: $db_user@$db_name (server $db_version, ssl=$db_ssl)"
        [[ $db_ssl == t ]] || fail "connection is not encrypted"
      else
        fail "cannot log in to Postgres: $(tail -n1 <<<"$db_out") — check the Azure firewall allows this VM's IP, and the role/password/database"
      fi
    fi
  fi

  echo
  if ((FAILS > 0)); then die "$FAILS check(s) failed"; fi
  ok "preflight passed"
}

cmd_nginx() {
  need_env_file
  local host api_port gen_port
  host=$(env_get API_HOST)
  [[ -n $host ]] || die "API_HOST is empty in $ENV_FILE"
  api_port=$(env_get API_HOST_PORT)
  gen_port=$(env_get GENERATOR_HOST_PORT)
  sed -e "s/argus\.example\.com/$host/g" \
    -e "s/127\.0\.0\.1:4000/127.0.0.1:${api_port:-4000}/" \
    -e "s/127\.0\.0\.1:4200/127.0.0.1:${gen_port:-4200}/" \
    deploy/nginx/argus.conf
}

wait_healthy() {
  local deadline=$((SECONDS + 180))
  for c in argus-api argus-generator; do
    until [[ $(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$c" 2>/dev/null) == healthy ]]; do
      if ((SECONDS > deadline)); then
        "${COMPOSE[@]}" ps
        die "$c not healthy after 3 min — ./deploy/vm.sh logs ${c#argus-}"
      fi
      sleep 3
    done
    ok "$c healthy"
  done
}

cmd_up() {
  need_env_file
  "${COMPOSE[@]}" pull
  "${COMPOSE[@]}" up -d --remove-orphans
  local migrate_exit
  migrate_exit=$(docker inspect -f '{{.State.ExitCode}}' argus-migrate 2>/dev/null || echo '?')
  if [[ $migrate_exit == 0 ]]; then ok "migrations applied"; else die "migrate exited $migrate_exit — ./deploy/vm.sh logs migrate"; fi
  wait_healthy
  cmd_status
}

cmd_status() {
  need_env_file
  "${COMPOSE[@]}" ps
  echo
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.CPUPerc}}' "${ARGUS_CONTAINERS[@]}" 2>/dev/null || true
}

cmd_user() {
  need_env_file
  [[ $# -eq 2 ]] || die "usage: ./deploy/vm.sh user <email> <admin|analyst|viewer>"
  # interactive run: the CLI prompts for the password without echoing it
  "${COMPOSE[@]}" run --rm --no-deps api node apps/api/dist/cli/create-user.js --email "$1" --role "$2"
}

cmd_backup() {
  need_env_file
  local dir=${1:-backups} file
  mkdir -p "$dir"
  file="$dir/argus-$(date +%Y%m%d-%H%M%S).sql.gz"
  (
    umask 077 # the dump contains password hashes
    pg_client 'pg_dump --no-owner --no-privileges' | gzip >"$file"
  )
  ok "wrote $file ($(du -h "$file" | cut -f1))"
}

cmd_rollback() {
  need_env_file
  [[ $# -eq 1 ]] || die "usage: ./deploy/vm.sh rollback <commit sha> (full 40-char sha, as tagged by CI)"
  ARGUS_API_IMAGE="ghcr.io/adiikj/argus-api:sha-$1" \
    ARGUS_GENERATOR_IMAGE="ghcr.io/adiikj/argus-generator:sha-$1" \
    "${COMPOSE[@]}" up -d api generator
  warn "running sha-$1 until the next 'up' — to pin it, set ARGUS_*_IMAGE in $ENV_FILE"
  warn "migrations are forward-only: this rolls back code, not the schema"
  wait_healthy
}

# --- verify: black-box checks against the public URL ---
http_code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$@" || echo 000; }

cmd_verify() {
  local base host
  base=${VERIFY_URL:-}
  if [[ -z $base ]]; then
    need_env_file
    host=$(env_get API_HOST)
    [[ -n $host ]] || die "API_HOST is empty in $ENV_FILE"
    base="https://$host"
  fi
  local cors_first
  cors_first=$(env_get CORS_ORIGIN | cut -d, -f1)
  cors_first=${VERIFY_ORIGIN:-$cors_first}
  echo "Verifying $base"

  local code headers
  code=$(http_code "$base/healthz")
  if [[ $code == 200 ]]; then ok "GET /healthz → 200"; else fail "GET /healthz → $code"; fi

  headers=$(curl -sS -D - -o /dev/null --max-time 10 "$base/healthz" 2>/dev/null | tr -d '\r' | tr 'A-Z' 'a-z')
  grep -q '^x-content-type-options: nosniff' <<<"$headers" && ok "security headers present" || fail "x-content-type-options header missing"
  grep -q '^server: .*[0-9]' <<<"$headers" && warn "Server header leaks a version — server_tokens off in nginx" || true

  code=$(http_code "$base/incidents")
  if [[ $code == 401 ]]; then ok "GET /incidents unauthenticated → 401 (login gate on)"; else fail "GET /incidents unauthenticated → $code (expected 401)"; fi

  code=$(http_code -X POST -H 'content-type: application/json' -d '{"email":"probe@example.com","password":"preflight-probe"}' "$base/auth/register")
  if [[ $code == 403 ]]; then ok "POST /auth/register → 403 (sign-up disabled)"; else fail "POST /auth/register → $code (expected 403 — ALLOW_REGISTRATION must be false)"; fi

  if curl -sS --max-time 10 "$base/simulate" 2>/dev/null | grep -q '"scenarios"'; then ok "GET /simulate → generator reachable"; else fail "GET /simulate did not reach the generator (nginx /simulate location?)"; fi

  if [[ -n $cors_first ]]; then
    local acao
    acao=$(curl -sS -D - -o /dev/null --max-time 10 -H "Origin: $cors_first" "$base/healthz" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
    if [[ $acao == "$cors_first" ]]; then ok "CORS allows $cors_first"; else fail "CORS: expected '$cors_first', got '${acao:-none}'"; fi
  fi
  local foreign
  foreign=$(curl -sS -D - -o /dev/null --max-time 10 -H 'Origin: https://evil.example' "$base/healthz" | tr -d '\r' | awk -F': ' 'tolower($1)=="access-control-allow-origin"{print $2}')
  if [[ -z $foreign ]]; then ok "CORS refuses a foreign origin"; else fail "CORS answered a foreign origin with '$foreign'"; fi

  local ws=(-H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==')
  code=$(http_code "${ws[@]}" -H 'Origin: https://evil.example' "$base/ws")
  if [[ $code == 403 ]]; then ok "WebSocket from a foreign origin → 403"; else fail "WebSocket from a foreign origin → $code (expected 403)"; fi
  code=$(http_code "${ws[@]}" -H "Origin: ${cors_first:-$base}" "$base/ws")
  if [[ $code == 401 ]]; then ok "WebSocket without a token → 401"; else fail "WebSocket without a token → $code (expected 401)"; fi

  if [[ $base == https://* ]]; then
    code=$(http_code "http://${base#https://}/healthz")
    if [[ $code == 301 || $code == 308 ]]; then ok "plain http redirects to https"; else warn "http:// → $code (certbot --nginx normally adds the redirect)"; fi
  fi

  echo
  if ((FAILS > 0)); then die "$FAILS check(s) failed"; fi
  ok "deployment looks right"
}

case ${1:-} in
  init) cmd_init ;;
  preflight) cmd_preflight ;;
  nginx) cmd_nginx ;;
  up | update) cmd_up ;;
  status) cmd_status ;;
  logs) need_env_file && "${COMPOSE[@]}" logs -f --tail 200 "${2:-api}" ;;
  user) shift && cmd_user "$@" ;;
  backup) shift && cmd_backup "$@" ;;
  rollback) shift && cmd_rollback "$@" ;;
  verify) cmd_verify ;;
  down) need_env_file && "${COMPOSE[@]}" down ;;
  *) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//' && exit 1 ;;
esac
