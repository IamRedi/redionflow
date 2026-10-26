# Demo image: builds the app and, on start, migrates and seeds fictitious data.
# Not a hardened production image (it keeps dev dependencies for prisma/tsx).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Build needs a syntactically valid URL only; nothing connects at build time.
ENV APP_ENV=demo \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://build@127.0.0.1:1/build \
    DIRECT_URL=postgresql://build@127.0.0.1:1/build
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -H 0.0.0.0 -p ${PORT}"]
