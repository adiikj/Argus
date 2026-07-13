# Build from the repo root: docker build -f apps/generator/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable
RUN npm install -g turbo@^2.3.3

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @argus/generator --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@argus/generator

# a second, --prod-only install so the runner never inherits devDependencies
# (tsc, turbo) that the installer stage needed to build.
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
COPY --from=installer /app/apps/generator/dist ./apps/generator/dist
EXPOSE 4200
CMD ["node", "apps/generator/dist/index.js"]
