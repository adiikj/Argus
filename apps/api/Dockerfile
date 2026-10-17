# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
# Prisma's engines link against OpenSSL — Alpine doesn't ship it by default.
RUN apk add --no-cache openssl
RUN corepack enable
RUN npm install -g turbo@^2.3.3

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @argus/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @argus/api exec prisma generate
RUN pnpm turbo run build --filter=@argus/api

# a second, --prod-only install so the runner never inherits devDependencies
# (tsc, turbo) that the installer stage needed to build. The prisma CLI is a
# real dependency on purpose: the same image runs `prisma migrate deploy` as
# the one-shot `migrate` service in docker-compose.prod.yml.
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --prod --frozen-lockfile

# workspace packages (@argus/contracts etc.) export raw .ts, run directly via
# Node's native type-stripping — there's no dist for them to copy, so the
# runner still needs their pruned source (out/full), just not dev tooling.
# pnpm nests a local node_modules (with the @argus/* symlinks) under every
# workspace package, not just the root, so prod-deps is copied wholesale
# before layering the real source on top — out/full carries no node_modules
# of its own, so it only adds files, never removes the ones just copied in.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app .
COPY --from=pruner /app/out/full/ .
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/apps/api/generated ./apps/api/generated
EXPOSE 4000
# drop root: the image's files stay root-owned (read-only to the process), and a
# compromised process can't rewrite its own code or install anything.
USER node
CMD ["node", "apps/api/dist/index.js"]
