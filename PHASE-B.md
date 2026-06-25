# Tend — Phase B: live integrations (UK banks via Lunch Flow · Trading 212)

**All on Vercel.** No extra hosting. The bank / Trading-212 API runs as a single
Python serverless function on your existing Vercel site at `/api`. You use three
services: **Vercel** (site + API), **Supabase** (login + data) and **Lunch Flow**
(the regulated Open Banking provider that connects to your UK banks).

> **Why Lunch Flow?** We checked everything. The big providers don't work for an
> individual reading their *own* UK accounts: **Enable Banking** doesn't cover the
> UK; **Plaid** gates UK behind an enterprise "custom plan"; **GoCardless/Nordigen**
> closed to new signups; **TrueLayer/Salt Edge** require FCA-agent registration or
> are sales-gated. **Lunch Flow** (lunchflow.app) is purpose-built for individuals,
> is self-serve, ~£3/month with a free trial, holds the AISP licence itself, and
> exposes a simple read-only REST API. Lloyds is confirmed working.

Everything is **gated**: while `config.js → BACKEND_URL` is blank, the function is
dormant and the app behaves exactly as today. You flip it on at the end.

---

## Architecture

```
 One Vercel project
 ┌──────────────────────────────────────────────────────────┐
 │  Static site  (index.html, app.jsx, cloud.js)            │
 │        │  fetch('/api/...') with the user's login token   │
 │        ▼                                                  │
 │  api/index.py  (Python serverless function) ── API keys ──┼──► Lunch Flow API
 │        │  service-role key                                │     (Lloyds, …)
 │        ▼                                                  ├──► Trading 212 API
 └────────┼──────────────────────────────────────────────────┘
          ▼
   Supabase `connections` table  (Lunch Flow + T212 keys — server-only)
```

You link your banks **inside Lunch Flow** (it does the regulated bank login), then
paste **one read-only API key** into Tend. Tend's function uses that key to pull
your accounts + transactions. Same pattern as Trading 212 — no redirects, no widget
embedded in Tend. The key is stored only in the locked Supabase table.

---

## What's already in the repo (code is DONE)

| File | Purpose |
|------|---------|
| `api/index.py` | the whole API (Lunch Flow Open Banking + Trading 212) as one Vercel function |
| `requirements.txt` | Python deps Vercel installs (`fastapi`, `httpx`) |
| `vercel.json` | routes every `/api/*` request to `api/index.py` |
| `supabase/bank_schema.sql` | the `connections` table (RLS on, server-only) |
| `config.js → BACKEND_URL` | the on/off switch (blank = off; `/api` = on) |
| `cloud.js → window.TendBank` | front-end client |
| `app.jsx` | Connect-bank tab (paste-key), Trading 212 panel |

The UI is fully wired and gated — it goes live the moment you finish Part A.

---

## Part A — YOUR setup steps

### A1 · Supabase (≈3 min)
1. Supabase → **SQL Editor** → New query → paste all of `supabase/bank_schema.sql` → **Run**.
2. **Project Settings → API** → copy the secret **`service_role`** key (used in A3).

### A2 · Lunch Flow (≈10 min) — DONE for Lloyds ✓
1. Sign up at **lunchflow.app** (free trial).
2. **Link your banks** (e.g. Lloyds) inside Lunch Flow — you log in on the bank's
   own screen; read-only.
3. Create a **REST API** destination (name it anything, e.g. "Tend") and copy the
   **API key** (`x-api-key`). You paste this **into Tend's screen**, not into Vercel.

### A3 · Add the secrets to Vercel (≈5 min)
Vercel → your project → **Settings → Environment Variables** (Production):

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://sapowtetcppfnlqcpjim.supabase.co` |
| `SUPABASE_ANON_KEY` | (same value already in `config.js`) |
| `SUPABASE_SERVICE_KEY` | the secret service-role key from A1 |
| `APP_URL` | `https://claude-test1-tend.vercel.app` |
| `T212_MODE` | `live` (or `demo` to practise) |

> Note: there are **no bank-provider secrets here** — your Lunch Flow and Trading
> 212 keys are pasted in-app and stored in the locked Supabase table.

### A4 · Trading 212 (optional, ≈2 min)
Trading 212 app → **Settings → API (Beta)** → create a **read-only** key. You'll
paste it into Tend's Investments tab.

### A5 · Flip the switch (≈1 min)
1. In `config.js`, change `BACKEND_URL: ""` to `BACKEND_URL: "/api"`.
2. Push (or tell me and I'll do it). Vercel redeploys; the function goes live.
3. **Check it's alive:** visit `https://claude-test1-tend.vercel.app/api` — you
   should see `{"ok": true, "providers": ["lunchflow", "t212"]}`.
4. In Tend → Finance → **Connect bank**, paste your Lunch Flow API key → Connect.
   Your transactions import, auto-categorised and de-duplicated.

---

## Security model
- The Lunch Flow + Trading 212 keys live only in Supabase `connections`, written
  only by the function's service-role key. RLS is on with no policies → the
  browser can't read them.
- Your **bank password is entered only inside Lunch Flow / on the bank's site** —
  Tend and the function never see it.
- The browser proves who it is with its Supabase login token; the function checks
  it and scopes every action to that user.
- `config.js` holds only public values.
- Read-only everywhere — nothing here can move money or trade.

---

## Adding more banks later
Link any extra bank **inside Lunch Flow** — Tend reads whatever accounts the key
exposes, so new banks appear automatically on the next sync. No code or config
change needed.
