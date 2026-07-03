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

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=installer /app .
EXPOSE 4200
CMD ["node", "apps/generator/dist/index.js"]
