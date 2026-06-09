# Tend bank backend (live Lloyds via Enable Banking)

A small FastAPI service that connects a user's **Lloyds** account through
**Enable Banking** (Open Banking) and returns normalised transactions to the
Tend front-end. It runs **separately from the static site** so your Vercel
deploy stays pure-static, and so bank tokens never touch the browser.

```
Browser (Tend) ──Supabase access token──▶ this backend ──signed JWT──▶ Enable Banking ──▶ Lloyds
                                              │
                                              └── stores session in Supabase (service-role)
```

## 1. Register an Enable Banking application

1. Sign up at **https://enablebanking.com** → **Control Panel**.
2. **Applications → New** → choose **Restricted Production** (free; you whitelist
   your *own* accounts, no contract).
3. Set the **redirect URL** to your future backend callback:
   `https://<your-backend>.onrender.com/bank/callback` (you'll get the host in step 3 — you can edit it after).
4. Download the **private key** (PEM) and copy the **Application ID**.
5. Whitelist your **Lloyds** account for this application (Control Panel → your app → add your Lloyds personal account).

## 2. Create the Supabase table

Supabase → SQL Editor → run [`../supabase/bank_schema.sql`](../supabase/bank_schema.sql).
Grab your **service-role key** from Project Settings → API (keep it secret).

## 3. Deploy the backend (Render free tier)

1. Push this repo's **`bank-backend`** branch to GitHub (already done if you're reading this there).
2. Render → **New → Blueprint** → pick the repo → it reads [`render.yaml`](render.yaml).
   (Or **New → Web Service**, root dir `backend`, build `pip install -r requirements.txt`,
   start `uvicorn main:app --host 0.0.0.0 --port $PORT`.)
3. Set the environment variables:

   | Var | Value |
   |-----|-------|
   | `ENABLE_APPLICATION_ID` | from step 1 |
   | `ENABLE_PRIVATE_KEY` | the PEM contents (paste with real newlines, or `\n`-escaped) |
   | `SUPABASE_URL` | `https://sapowtetcppfnlqcpjim.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon key |
   | `SUPABASE_SERVICE_KEY` | your **service-role** key |
   | `APP_URL` | `https://claude-test1-tend.vercel.app` |
   | `BACKEND_URL` | your Render URL, e.g. `https://tend-bank.onrender.com` |
   | `ACCESS_VALID_DAYS` | `90` |

4. After it deploys, copy the Render URL and make sure the Enable Banking
   **redirect URL** (step 1) matches `<BACKEND_URL>/bank/callback` exactly.

## 4. Point the app at the backend

In [`../config.js`](../config.js) set `BACKEND_URL` to your Render URL and deploy
the front-end. The Finance → **Connect bank** tab will then show a live
**Connect Lloyds** button.

## Flow / endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /bank/auth` | Start consent — returns `{ url }` to send the user to Lloyds |
| `GET /bank/callback` | Enable Banking redirects here; stores the session, bounces back to the app |
| `GET /bank/status` | Is a bank connected? how many accounts? |
| `GET /bank/transactions?days=90` | Normalised `{date, amount, type, description}` list |
| `POST /bank/disconnect` | Forget the connection |

## Notes / caveats

- Endpoint and field names follow Enable Banking's public API. If EB has changed
  them, adjust [`enable_banking.py`](enable_banking.py) — it's all in one place.
- Consent expires after `ACCESS_VALID_DAYS`; re-connect when it lapses.
- Run locally: `uvicorn main:app --reload` with the env vars exported, and set
  `BACKEND_URL=http://localhost:8000`, `APP_URL=http://localhost:4178`.
