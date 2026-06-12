# Tend — Phase B: live integrations (Lloyds UK · Chase UK · Trading 212)

**All on Vercel.** No Render, no extra hosting. The bank/Trading-212 API runs as
a single Python serverless function on your existing Vercel site at `/api`.
You use exactly two services: **Vercel** (site + API) and **Supabase** (login + data).

Everything is **gated**: while `config.js → BACKEND_URL` is blank, the function is
dormant and the app behaves exactly as today. You flip it on at the very end.

---

## Architecture

```
 One Vercel project
 ┌──────────────────────────────────────────────────────────┐
 │  Static site  (index.html, app.jsx, cloud.js)            │
 │        │  fetch('/api/...') with the user's login token   │
 │        ▼                                                  │
 │  api/index.py  (Python serverless function)  ── secrets ──┼──► Enable Banking
 │        │  service-role key                                │     (Lloyds, Chase)
 │        ▼                                                  ├──► Trading 212 API
 └────────┼──────────────────────────────────────────────────┘
          ▼
   Supabase `connections` table  (bank tokens + T212 key — server-only)
```

Because the site and API share one domain, there's no CORS and no second URL to
manage. Secrets live only in Vercel's Environment Variables + the locked Supabase
table — never in the browser.

---

## What's already in the repo

| File | Purpose |
|------|---------|
| `api/index.py` | the whole API (Lloyds + Chase + Trading 212) as one Vercel function |
| `requirements.txt` | Python deps Vercel installs for that function |
| `vercel.json` | routes every `/api/*` request to `api/index.py` |
| `supabase/bank_schema.sql` | the `connections` table (RLS on, server-only) |
| `privacy.html` / `terms.html` | served at `/privacy` and `/terms` (needed by Enable Banking) |
| `config.js → BACKEND_URL` | the on/off switch (blank = off; `/api` = on) |
| `cloud.js → window.TendBank` | front-end client (dormant until switched on) |

Still TODO (my side, once it's switched on): wire the UI — Connect buttons,
the `?bank=connected` redirect handler with de-dupe, the Trading 212 panel, a
connections list, and swapping manual figures for live ones.

---

## Part A — YOUR setup steps

### A1 · Supabase (2 min)
1. Supabase → **SQL Editor** → New query → paste all of `supabase/bank_schema.sql` → **Run**.
2. **Project Settings → API** → copy the **`service_role`** key (secret). You'll paste it into Vercel in A4.

### A2 · Enable Banking — powers BOTH Lloyds and Chase (~20 min)
1. Sign up at **enablebanking.com** → create an **Application** (free "Restricted Production").
2. Fill the application form — see **"Enable Banking form answers"** at the bottom of this file.
3. Whitelist your own **Lloyds** and **Chase UK** accounts (so you can test with them).
4. Save the **Application ID** and the **private key** file (PEM) it gives you.

### A3 · Trading 212 (2 min)
1. Trading 212 app → **Settings → API (Beta)** → create a **read-only** API key.
2. Keep it for later — you'll paste it **into Tend's screen**, not into any file.

### A4 · Add the secrets to Vercel (5 min)
Vercel → your project → **Settings → Environment Variables**. Add each of these
(Name on the left, value on the right), for the **Production** environment:

| Name | Value |
|------|-------|
| `ENABLE_APPLICATION_ID` | from A2 |
| `ENABLE_PRIVATE_KEY` | the whole PEM file contents from A2 (paste as-is) |
| `SUPABASE_URL` | `https://sapowtetcppfnlqcpjim.supabase.co` |
| `SUPABASE_ANON_KEY` | (same value already in `config.js`) |
| `SUPABASE_SERVICE_KEY` | the secret service-role key from A1 |
| `APP_URL` | `https://claude-test1-tend.vercel.app` (your site URL) |
| `ACCESS_VALID_DAYS` | `90` |
| `T212_MODE` | `live` (or `demo` to practise) |

### A5 · Flip the switch (1 min)
1. In `config.js`, change `BACKEND_URL: ""` to `BACKEND_URL: "/api"`.
2. Push (or tell me and I'll do it). Vercel redeploys; the function goes live.
3. Tell me it's on → I build the buttons (Part B) and we test together.

> Checking it works: after A4+A5 deploy, visit
> `https://claude-test1-tend.vercel.app/api` in your browser — you should see a
> small JSON like `{"ok": true, ...}`. That means the function is alive.

---

## Part B — MY steps (after it's switched on)
Connect tab → live Lloyds/Chase buttons + sync + disconnect; the
`?bank=connected` redirect handler that de-dupes new transactions; Trading 212
panel in Investments; a "Linked accounts" list; auto-sync + consent-expiry
handling; and swapping manual balances for live ones.

---

## Security model
- Bank tokens + the Trading 212 key live only in Supabase `connections`, written
  only by the function's service-role key. RLS is on with no policies → the
  browser can't read them.
- The browser proves who it is with its Supabase login token; the function checks
  it and scopes every action to that user.
- `config.js` holds only public values. Secrets live only in Vercel env vars.
- Read-only everywhere — nothing here can move money or trade.

---

## Enable Banking form answers (A2)

| Field | What to put |
|-------|-------------|
| **Application name** | `Tend` |
| **Allowed redirect URLs** | `https://claude-test1-tend.vercel.app/api/bank/callback` (one per line; add your custom domain's version too if you have one) |
| **Application description** | `Tend is a personal finance and task manager for my own use. It reads my bank transactions on a read-only basis via Open Banking to show my spending, budgets and net worth. It never moves money.` |
| **Email for data protection matters** | `joshrussell099@gmail.com` |
| **Privacy URL** | `https://claude-test1-tend.vercel.app/privacy` |
| **Terms URL** | `https://claude-test1-tend.vercel.app/terms` |

> Note: if Enable Banking lists Chase as "Chase UK" (not "Chase"), tell me and I
> change one word in `api/index.py`.
