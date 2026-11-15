# syntax=docker/dockerfile:1
# Build context: code/. No database connection or credentials are needed to build.
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY . .
ENV ISLAND_DATABASE_PROVIDER=postgresql ISLAND_STANDALONE=1
RUN npm run db:generate && npm run db:validate && npm run test:database && npm test && npm run build

# Separate maintenance image; never run migrations automatically with the Web server.
FROM dependencies AS tools
COPY prisma ./prisma
COPY prisma.postgresql.config.mjs ./
COPY scripts/postgres-cli.mjs ./scripts/postgres-cli.mjs
COPY src/lib/databaseConfig.js ./src/lib/databaseConfig.js
ENV ISLAND_DATABASE_PROVIDER=postgresql
USER node
CMD ["node", "scripts/postgres-cli.mjs", "status"]

FROM base AS web
ENV NODE_ENV=production ISLAND_DATABASE_PROVIDER=postgresql PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
