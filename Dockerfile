# MANI — single image for Azure Container Apps (API + Next + Caddy)
FROM node:22-bookworm AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/scripts ./scripts
RUN npm ci
COPY frontend/ ./
# Baked into the Next bundle; set --build-arg when the OAuth Web Client ID exists.
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      | tee /etc/apt/sources.list.d/caddy-stable.list \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get update && apt-get install -y --no-install-recommends caddy nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY data/ /app/data/
COPY infra/azure/Caddyfile /etc/caddy/Caddyfile
COPY infra/azure/start.sh /app/start.sh
RUN chmod +x /app/start.sh

COPY --from=frontend-build /frontend/.next /app/frontend/.next
COPY --from=frontend-build /frontend/public /app/frontend/public
COPY --from=frontend-build /frontend/package.json /app/frontend/package.json
COPY --from=frontend-build /frontend/node_modules /app/frontend/node_modules
COPY --from=frontend-build /frontend/next.config.ts /app/frontend/next.config.ts

ENV APP_ENV=production \
    DEBUG=false \
    HORIZONS_FORCE_OFFLINE=false \
    DATABASE_URL=sqlite:////app/data/mani.db \
    API_PROXY_TARGET=http://127.0.0.1:8100 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

EXPOSE 8080
CMD ["/app/start.sh"]
