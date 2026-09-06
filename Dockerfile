# Local development image (Cloudflare Workers + Next.js).
# Production is deployed to Cloudflare, not this image.
FROM node:22-bookworm

WORKDIR /app

ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    WRANGLER_SEND_METRICS=false \
    npm_config_update_notifier=false

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN npm ci \
    && mkdir -p /opt/npm \
    && cp -a /app/node_modules /opt/npm/root \
    && if [ -d /app/backend/node_modules ]; then cp -a /app/backend/node_modules /opt/npm/backend; fi \
    && if [ -d /app/frontend/node_modules ]; then cp -a /app/frontend/node_modules /opt/npm/frontend; fi \
    && sha256sum package-lock.json | awk '{print $1}' > /opt/npm/lockhash

COPY . .
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh scripts/docker-entrypoint.sh

EXPOSE 8787 5173

ENTRYPOINT ["/docker-entrypoint.sh"]
