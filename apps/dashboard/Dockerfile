# Build from the repo root: docker build -f apps/dashboard/Dockerfile .
FROM node:24-alpine AS base
RUN corepack enable
RUN npm install -g turbo@^2.3.3

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @argus/dashboard --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json

# NEXT_PUBLIC_* vars are baked into the client bundle at build time, not read
# at container runtime — they have to arrive as build args, not `environment:`.
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_GENERATOR_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_GENERATOR_URL=$NEXT_PUBLIC_GENERATOR_URL

RUN pnpm turbo run build --filter=@argus/dashboard

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next.js standalone output only carries the files each server actually needs.
COPY --from=installer --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/dashboard/server.js"]
