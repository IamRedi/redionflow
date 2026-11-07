# Nightly encrypted database backup (Railway cron service). No web server,
# no Next build: pg_dump 18 (matches the Railway Postgres 18 image) + Node.
#
# The Railway service uses Root Directory /ops/backup-cron, so the app's
# railway.json (healthcheck, app Dockerfile) does not apply here. The code is
# taken from the exact commit Railway is deploying.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl gnupg git \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && apt-get purge -y curl gnupg && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ARG RAILWAY_GIT_COMMIT_SHA
RUN test -n "$RAILWAY_GIT_COMMIT_SHA" \
  && git init -q /repo && cd /repo \
  && git fetch -q --depth 1 https://github.com/IamRedi/redionflow.git "$RAILWAY_GIT_COMMIT_SHA" \
  && git checkout -q FETCH_HEAD \
  && mkdir -p /app/src/lib \
  && cp -r package.json package-lock.json vendor scripts tsconfig.json /app/ \
  && cp -r src/lib/backup /app/src/lib/ \
  && rm -rf /repo

WORKDIR /app
RUN npm ci --no-audit --no-fund --ignore-scripts && npm cache clean --force

ENV NODE_ENV=production BACKUP_PG_BIN_DIR=/usr/lib/postgresql/18/bin
CMD ["node", "--import", "tsx", "scripts/backup-cron.ts"]
