# MANI — Moon Analysis & Navigation Intelligent

**Team Nova 3** · NASA Space Apps Challenge 2026 · Tegucigalpa

Web app to compare south-pole landing sites using **NASA/JPL Horizons** ephemerides and a **Cesium** globe with **NASA Moon Trek** imagery.

## Quick start

```bat
MANI.bat
```

Or manually:

1. API: `cd backend && .venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8100`
2. Web: `cd frontend && npm run dev` → http://localhost:3100

Admin seed: `admin@mani.nova3` / `Nova3Mani!` (or register a new account).

## Ports

| Service | Port |
|---------|------|
| Next.js | 3100 |
| FastAPI | 8100 |
| Oracle HTTPS | 9543 (`https://158.101.2.100:9543`) |
| Azure (público) | `https://mani-web.ashysky-26ab9584.eastus.azurecontainerapps.io` |

## Docs

- [Deploy](docs/DEPLOY.md)
- [SI declaration](docs/SI_DECLARATION.md)
- [Oracle Caddy](infra/oracle/README.md)
