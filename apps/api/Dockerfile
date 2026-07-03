# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
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

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app .
EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
