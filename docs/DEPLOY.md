# Deploy MANI locally (Chiminike / offline-capable)

## Ports

- Frontend: **3100**
- Backend: **8100**
- Oracle HTTPS: **9543** → `https://158.101.2.100:9543`

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

## Offline demo

Comparison uses packaged Horizons JSON — no live JPL call required. Moon Trek tiles need network; without wifi the globe falls back to a solid lunar base and markers still work.
