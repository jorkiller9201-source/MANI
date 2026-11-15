# Deploy MANI locally (Chiminike / offline-capable)

## Ports

- Frontend: **3100**
- Backend: **8100**
- Oracle HTTPS: **9543** → `https://158.101.2.100:9543`
- Azure (público): `https://mani-web.ashysky-26ab9584.eastus.azurecontainerapps.io`

## Backend

```bat
cd backend
.venv\Scripts\activate
python scripts\seed.py
uvicorn main:app --host 0.0.0.0 --port 8100
```

Default admin: `admin@mani.nova3` / `Nova3Mani!`

Horizons cache already in `data/horizons/*.json` (refresh with `python scripts/fetch_horizons.py` when online).

## Frontend

```bat
cd frontend
npm run dev
```

Open http://localhost:3100

## Google Sign-In (optional)

Uses **Google Identity Services** (ID token). No inventes secrets: créalos en Google Cloud.

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create credentials → **OAuth client ID** → Application type **Web application**.
2. Authorized JavaScript origins: `http://localhost:3100`, `https://mani-nova3.duckdns.org`, and the Azure URL if needed.
3. Authorized redirect URIs: the same origins (path `/` is fine).
4. Copy **Client ID** into:
   - `backend/.env` → `GOOGLE_CLIENT_ID=...`
   - `frontend/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`
   - Azure: env `GOOGLE_CLIENT_ID` on the container; rebuild image with  
     `docker build --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=...` (Next bakes public env at build).
5. Restart backend and frontend. Login shows **Continue with Google** when the public Client ID is set.

`GOOGLE_CLIENT_SECRET` is unused for the ID-token flow (leave blank).

## Offline demo

Comparison uses packaged Horizons JSON — no live JPL call required. Moon Trek tiles need network; without wifi the globe falls back to a solid lunar base and markers still work.
