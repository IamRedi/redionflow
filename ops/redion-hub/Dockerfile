# Redion Hub (Railway service, Root Directory /ops/redion-hub, volume at /data).
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HUB_DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs ./
COPY public ./public
EXPOSE 8080
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
