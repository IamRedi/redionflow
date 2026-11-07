# Nightly encrypted database backup (Railway cron service). No web server,
# no Next build: pg_dump 18 (matches the Railway Postgres 18 image) + Node.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && apt-get purge -y curl gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY scripts ./scripts
COPY src/lib/backup ./src/lib/backup
COPY tsconfig.json ./

ENV NODE_ENV=production BACKUP_PG_BIN_DIR=/usr/lib/postgresql/18/bin
CMD ["node", "--import", "tsx", "scripts/backup-cron.ts"]
