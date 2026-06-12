# Tend — Phase B: live integrations (Lloyds UK · Chase UK · Trading 212)

This document is the plan + task list. The **groundwork is already in this repo**
(see "What's already built"). Everything is **gated**: with `config.js →
BACKEND_URL` blank, the app behaves exactly as today (manual / CSV / sample
data). Flip it on by deploying the backend and setting that URL.

---

## Architecture (how it fits together)

```
 Browser (static site on Vercel)                    Backend (FastAPI on Render)
 ┌─────────────────────────────┐                    ┌──────────────────────────┐
 │ app.jsx / cloud.js          │  Bearer <supabase  │ /bank/auth  /bank/txns   │
 │  window.TendBank.* ─────────┼──  access token ──▶│ /t212/connect /portfolio │
 │  (gated by BACKEND_URL)     │                    │                          │
 └─────────────────────────────┘                    └───────────┬──────────────┘
        ▲                                                        │ service-role key
        │ JSON (normalised txns / portfolio)                     ▼
        │                                              ┌──────────────────────┐
        │                                              │ Supabase             │
        └──────────────────────────────────────────────│  connections table   │
                                                        │  (bank tokens, T212  │
                                                        │   key — server-only) │
                                                        └──────────────────────┘
                       Enable Banking (Lloyds, Chase)  ◀── RS256 JWT
                       Trading 212 API                 ◀── api key
```

**Why a separate backend?** Bank/broker secrets must never touch the browser,
and Trading 212 is CORS-blocked from the browser. The static site stays on
Vercel; the backend runs on Render and reads/writes secrets via Supabase's
service-role key.

**Two integration paths, three providers:**
- **Open Banking (Enable Banking)** covers **Lloyds** and **Chase** — same code,
  different ASPSP name. Adding a third UK bank later is one line.
- **Trading 212** is its own read-only Invest API.

---

## What's already built (in this repo)

| File | Purpose |
|------|---------|
| `backend/main.py` | FastAPI app: `/bank/*` (Lloyds+Chase), `/t212/*`, `/connections` |
| `backend/enable_banking.py` | Enable Banking client (JWT auth, consent, txns) |
| `backend/trading212.py` | Trading 212 client (cash + positions → normalised) |
| `backend/supabase_store.py` | per-user connection CRUD via service-role key |
| `backend/render.yaml` | Render blueprint + env var list |
| `backend/requirements.txt` / `README.md` | deps + run/deploy guide |
| `supabase/bank_schema.sql` | `connections` table (RLS on, server-only) |
| `config.js` → `BACKEND_URL` | the on/off switch (blank = off) |
| `cloud.js` → `window.TendBank` | front-end client (gated) + `getAccessToken()` |

Still **TODO (my side, once the backend is live):** wire the UI — the Connect
tab (Lloyds/Chase buttons + sync), the Investments tab (Trading 212), de-dupe
imported transactions, and the `?bank=connected` redirect handler. Listed in
**Part B** below.

---

## Part A — YOUR tasks (accounts, keys, deploy)

Do these once; each is independent. Tick them off and tell me when done.

### A1 · Supabase (shared by all three)
- [ ] Open Supabase → **SQL Editor** → paste & run `supabase/bank_schema.sql`.
- [ ] Project Settings → API → copy the **service-role** key (secret) — you'll
      paste it into Render, **never** into `config.js`.

### A2 · Enable Banking (powers Lloyds **and** Chase)
- [ ] Sign up at **enablebanking.com** → create an **Application** (Restricted
      Production is free; no contract).
- [ ] Whitelist your own **Lloyds** and **Chase UK** accounts for testing.
- [ ] Note the **Application ID** and download the **RSA private key** (PEM).
- [ ] Set the application's **redirect URL** to `<BACKEND_URL>/bank/callback`
      (you'll know `BACKEND_URL` after A4).
- [ ] (Confirm Chase is listed: in EB's `GET /aspsps?country=GB` the names should
      include "Lloyds" and "Chase". If Chase shows as e.g. "Chase UK", tell me and
      I'll tweak one line in `backend/main.py`.)

### A3 · Trading 212
- [ ] In the Trading 212 app → **Settings → API (Beta)** → generate a
      **read-only** API key (for the account you want: Invest or ISA).
- [ ] Keep it handy — you'll paste it **into Tend** once the UI is wired (it's
      stored server-side, not in `config.js`). Use a **demo** key first if you'd
      rather test against a practice account (`T212_MODE=demo`).

### A4 · Deploy the backend (Render, free)
- [ ] Render → **New → Blueprint** → point at this repo. It reads `render.yaml`.
- [ ] Set the secret env vars: `ENABLE_APPLICATION_ID`, `ENABLE_PRIVATE_KEY`,
      `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`.
- [ ] After first deploy, copy the service URL (e.g.
      `https://tend-backend.onrender.com`) → set it as `BACKEND_URL` in Render
      **and** go back and finish the EB redirect URL in A2.

  > Deploy note: the backend lives in `backend/` and is `.vercelignore`d so it
  > never affects the Vercel static deploy. `render.yaml` currently points Render
  > at the `main` branch — change `branch:` there if you keep the backend on a
  > separate branch instead.

### A5 · Turn it on (front-end)
- [ ] Set `BACKEND_URL` in `config.js` to your Render URL.
- [ ] Redeploy the static site (push to `main`).
- [ ] Tell me it's live → I do **Part B** and we test end-to-end.

---

## Part B — MY tasks (implementation, after the backend is live)

1. **Connect tab → live.** Replace the disabled "Connect Lloyds" card with
   **Connect Lloyds / Connect Chase** buttons (`TendBank.connectBank`), a
   per-bank connected state + last-sync time, **Sync now** (`syncTransactions`)
   and **Disconnect**.
2. **`?bank=connected` handler.** On redirect back from the bank, auto-sync and
   show a success toast; de-dupe new bank txns into `state.transactions`
   (match on date+amount+description, tag `source:"bank"`, never double-import).
3. **Trading 212 → Investments tab.** Replace the disabled card with a key
   field (`connectT212`) + a live holdings/cash view from `getPortfolio`, and
   fold the value into Net Worth (alongside manual holdings).
4. **Connections hub.** A small "Linked accounts" panel (Settings or Finance)
   listing all three with connect/disconnect + status (`listConnections`).
5. **Auto-sync cadence + resilience.** Sync on login and on a gentle interval,
   with graceful "reconnect needed" when an Open Banking consent expires
   (~90 days) and Trading-212 rate-limit backoff.
6. **Replace manual figures with live.** Current-account balances, the cash-flow
   "live bank balance", and the Investments tab switch from manual entry to the
   synced values (manual stays as fallback when disconnected).
7. **AI auto-categorisation (optional).** Tag incoming bank txns by category via
   the existing offline guesser, upgradeable to a Claude call later.

---

## Security model (already enforced by the groundwork)

- Bank session ids + the Trading 212 key live **only** in Supabase
  `connections`, written **only** by the backend's service-role key. RLS is on
  with **no policies**, so the browser's anon key can't read them.
- The browser authenticates to the backend with the user's **Supabase access
  token**; the backend verifies it and scopes every action to that user.
- `config.js` only ever holds **public** values (Supabase URL + anon key +
  the backend URL). No secret is ever shipped to the browser.
- Read-only everywhere: Open Banking AIS scope + a read-only Trading 212 key —
  nothing here can move money.
```
