# Tend Phase-B backend

Live bank + investment data for the Tend static front-end. Runs as a small
FastAPI service (designed for **Render**, free tier). It never runs on Vercel —
the `backend/` folder is `.vercelignore`d so Vercel only ships the static site.

## What it connects

| Provider     | How                                   | Data |
|--------------|---------------------------------------|------|
| Lloyds UK    | Open Banking via **Enable Banking**   | transactions, balances |
| Chase UK     | Open Banking via **Enable Banking**   | transactions, balances |
| Trading 212  | Official **Invest API** (read-only)   | cash + open positions |

Secrets (bank session ids, the Trading 212 key) live only in the Supabase
`connections` table, written exclusively by this service with the service-role
key. The browser never sees them.

## Endpoints

```
GET  /                      health + provider list
GET  /connections           what this user has linked
POST /bank/auth?bank=lloyds start consent → { url } (also bank=chase)
GET  /bank/callback         Enable Banking redirect target (set this in EB)
GET  /bank/transactions?days=90   normalised txns across all linked banks
POST /bank/disconnect?bank=lloyds
POST /t212/connect          body { api_key } — validates + stores
GET  /t212/portfolio        { cash, invested, result, total, holdings[] }
POST /t212/disconnect
```

All except `/` and `/bank/callback` require `Authorization: Bearer <supabase access token>`.

## Local run

```bash
cd backend
pip install -r requirements.txt
export ENABLE_APPLICATION_ID=... ENABLE_PRIVATE_KEY="$(cat key.pem)"
export SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_KEY=...
export APP_URL=http://localhost:4178 BACKEND_URL=http://localhost:8000
uvicorn main:app --reload --port 8000
```

Then in `config.js` set `BACKEND_URL: "http://localhost:8000"` and the
Connect/Investments tabs go live.

## Deploy (Render)

1. Run `supabase/bank_schema.sql` in Supabase once.
2. Render → New → Blueprint → this repo, `main` branch (uses `render.yaml`).
3. Set the secret env vars (see `render.yaml`), incl. `BACKEND_URL` = your Render URL.
4. In Enable Banking, set the app redirect to `<BACKEND_URL>/bank/callback`.
5. Set `BACKEND_URL` in `config.js` (front-end) and redeploy the static site.

## Provider notes

- **Enable Banking**: free "Restricted Production" lets you whitelist your own
  Lloyds + Chase accounts. Confirm the exact ASPSP names via
  `GET /aspsps?country=GB` and adjust `OPEN_BANKING` in `main.py` if they differ
  (e.g. "Chase" vs "Chase UK").
- **Trading 212**: create a read-only API key in the app (Settings → API). The
  API is rate-limited — cache and avoid tight polling. Use `T212_MODE=demo` for
  a practice account key.
