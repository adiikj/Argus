# Shipping real logs to Argus

`POST /ingest` takes log lines from any host and puts them on the same
pipeline as the simulated traffic: the same parsers, rules, incidents and AI
summaries. Two ready configs are here, one for [Vector](https://vector.dev)
and one for [Fluent Bit](https://fluentbit.io). Each ships an nginx access log
and sshd logins.

## 1. Turn ingest on

Ingest is off until the api has at least one token. On the deploy VM:

```sh
./deploy/vm.sh init        # generates INGEST_TOKENS in .env.vm if it is empty
./deploy/vm.sh up          # restart the api with it
```

or set it by hand: `INGEST_TOKENS=$(openssl rand -hex 32)`. It is a comma list,
so a second token can be added before the first is removed. Give each host its
own token: a leaked one only lets someone write log lines, and it can be
revoked without touching the others.

Behind the host nginx, `/ingest` needs a bigger body limit than the rest of
the api. `deploy/nginx/argus.conf` has the `location = /ingest` block. Copy it
into the live site file if that file was created before it existed.

`./deploy/vm.sh verify` checks the endpoint answers 401 to a bad token.

## 2. Ship

**Vector**

```sh
export ARGUS_URL=https://api.argus.buzz
export ARGUS_INGEST_TOKEN=<token>
vector --config deploy/shippers/vector.yaml
```

**Fluent Bit**

```sh
export ARGUS_HOST=api.argus.buzz
export ARGUS_INGEST_TOKEN=<token>
fluent-bit -c deploy/shippers/fluent-bit.yaml
```

Both read the nginx log from `/var/log/nginx/access.log` (combined format) and
sshd from the systemd journal (`ssh.service` or `sshd.service`). Change the
paths or units to match the host.

## 3. Or just curl it

```sh
curl -X POST "https://api.argus.buzz/ingest?source=auth" \
  -H "Authorization: Bearer $ARGUS_INGEST_TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary 'Failed password for invalid user admin from 203.0.113.9 port 40022 ssh2'
```

```json
{ "accepted": 1, "rejected": 0 }
```

## What the endpoint accepts

| | |
| --- | --- |
| `?source=` | `nginx`, `auth` or `api-gateway`. A record can carry its own `source` instead. |
| Body | a JSON array of records, one record, newline-delimited JSON, or plain text with one log line per line |
| Record | the line in `message`, `log` or `MESSAGE`, plus an optional `timestamp` (ISO 8601 or epoch seconds) |
| Limits | 1 MB per request, 1,000 records, 16 KB per line |
| Response | `202` with accepted and rejected counts, `401` for a bad token, `404` when ingest is off |

Lines that don't parse are dropped before they reach the rules, and counted
in the api's `/metrics` as `parseFailures` (accepted lines as `logsIngested`).
Timestamps more than five minutes in the future are replaced with the time the
line arrived.

Line formats:

- **nginx**: the default `combined` access log format.
- **auth**: OpenSSH login lines, with or without the syslog prefix:
  `Failed password for root from 198.51.100.7 port 51000 ssh2`,
  `Failed password for invalid user admin from …`,
  `Accepted publickey for deploy from …`.
- **api-gateway**: one JSON object per line:
  `{"ip":"203.0.113.5","method":"GET","path":"/api/orders","status":401}`.
