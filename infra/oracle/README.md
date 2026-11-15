# MANI on Oracle (`158.101.2.100:9543`)

Same pattern as Heimdall/FA-6 cloud bridge, **new HTTPS port 9543**.

## Open on the Oracle VCN

| Protocol | Port | Purpose |
|----------|------|---------|
| TCP | **9543** | MANI HTTPS (Caddy) |

Do **not** expose 3100 or 8100 to the internet.

## Install Caddy snippet

```bash
sudo cp /path/to/MANI/infra/oracle/Caddyfile /etc/caddy/Caddyfile.mani
# Merge into main Caddyfile or run a dedicated caddy instance for :9543
sudo systemctl reload caddy
```

If the app runs on Windows behind WireGuard, point `reverse_proxy` to the Windows tunnel IP (e.g. `10.200.200.2:3100` / `:8100`) instead of `127.0.0.1`.

## CORS

Backend `CORS_ALLOW_ORIGINS` must include:

`https://158.101.2.100:9543`

## Public URL

`https://158.101.2.100:9543`
