#!/bin/sh
set -eu

cd /app/backend
uvicorn main:app --host 127.0.0.1 --port 8100 &
API_PID=$!

cd /app/frontend
PORT=3100 HOSTNAME=127.0.0.1 node_modules/.bin/next start -p 3100 -H 127.0.0.1 &
WEB_PID=$!

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile &
CADDY_PID=$!

trap 'kill $API_PID $WEB_PID $CADDY_PID 2>/dev/null || true' EXIT INT TERM

while kill -0 "$API_PID" 2>/dev/null \
  && kill -0 "$WEB_PID" 2>/dev/null \
  && kill -0 "$CADDY_PID" 2>/dev/null; do
  sleep 5
done

exit 1
