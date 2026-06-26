# TendOS 🌱

Your life, tended. A personal, AI-assisted life manager — tasks you talk to in
plain English, plus finances, people, and documents in one private app. Runs as a
responsive web app and installable PWA (works on iPhone).

**Live:** https://claude-test1-tend.vercel.app

## What's inside

TendOS is organised into a few sections, all behind your private login:

- **Home** — a daily briefing: greeting by name, an **Ask Claude** box (plan your
  day, check your money, or just say "add …"), finance snapshot, today & upcoming
  tasks, important dates, and trips.
- **Tasks** — natural-language **Quick Add** (*"buy mum a present by 15 jun, high
  #gift"* fills in dates, priority and tags), groups, dual dates (scheduled +
  deadline), rainy-day/someday items, subtasks, notes, repeats, a calendar grid,
  focus mode, a Done tab, and a weekly review.
- **People** — profiles for the people who matter: relationships, birthdays,
  anniversaries and key dates (with auto-created reminder/gift to-dos), wishlists,
  and **AI gift ideas** tailored to each person.
- **Finance** — budgets and plan-vs-actuals, spending trends, spend-by-shop, net
  worth, debts, and **investments**. Optionally links your **bank accounts**
  (UK/EU Open Banking via Lunch Flow) and **Trading 212** to pull live balances,
  transactions and holdings.
- **Documents & Policies** — job, insurance, important documents, warranties, a
  digital-life audit, and drag-and-drop **file uploads** (stored privately in
  Supabase Storage).
- **Settings** — your name, light/dark/system theme + accent colour (persisted),
  tags, and calendar export.

Cross-cutting:

- **Accounts** — email/password or Sign in with Google; each person gets a private,
  cloud-synced workspace that follows them across devices.
- **AI (optional)** — when an Anthropic API key is set, Quick Add, gift ideas and
  Ask Claude use Claude (the "AI Chief of Staff" persona). Without a key, the app
  falls back to built-in offline helpers and works exactly the same, just without
  real AI. The AI routes are **gated to the owner's account** so visitors can't
  spend your API credits.
- **Apple Calendar** — export any dated task, or all of them, as a one-time `.ics`
  file. *(A live auto-refreshing subscription feed is planned — see Status below.)*

## Tech

- **Front-end:** single-file React app (`app.jsx`) transpiled in the browser by
  Babel — no build step. React/Babel are pinned in `vendor/`.
- **Auth + data:** **Supabase** (Postgres + Auth). Each user's whole app state lives
  in one row (`user_state`) protected by Row-Level Security; bank/Trading 212 secrets
  live in a separate, service-role-only `connections` table; uploaded files live in a
  private `documents` storage bucket.
- **Backend:** one **Vercel Python serverless function**, `api/index.py` (FastAPI).
  `vercel.json` rewrites every `/api/*` request to it. It handles banking
  (Lunch Flow), investments (Trading 212), and the AI routes.
- **AI:** Anthropic **Claude** API (`/api/parse`, `/api/gifts`, `/api/ask`).

## Setup

- **Accounts + Supabase:** see [`SETUP-ACCOUNTS.md`](SETUP-ACCOUNTS.md).
- **Live bank + investments (Phase B):** see [`PHASE-B.md`](PHASE-B.md).
- **File uploads:** see [`DOCUMENTS-SETUP.md`](DOCUMENTS-SETUP.md).
- **AI (optional):** add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment
  Variables. It's restricted to the email(s) in `AI_ALLOWED_EMAILS` (defaults to the
  owner). Optional model overrides: `CLAUDE_MODEL` (default `claude-opus-4-8`),
  `CLAUDE_FAST_MODEL` (default `claude-haiku-4-5-20251001`). See [`PHASE-B.md`](PHASE-B.md).
- **Run locally:** `python -m http.server 4178` → http://localhost:4178. This serves
  the static files only; the `/api/*` backend runs on Vercel, so AI/bank features are
  inactive locally and the app uses its offline fallbacks.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Shell; loads React/Babel (`vendor/`), `config.js`, `cloud.js`, `app.jsx` |
| `app.jsx` | The entire app UI |
| `cloud.js` | Supabase auth + cloud save/load, plus the authed backend clients (`TendCloud`, `TendBank`, `TendAI`) |
| `config.js` | Public Supabase URL + anon key, and `BACKEND_URL` (`/api`) |
| `api/index.py` | FastAPI serverless backend: banking, investments, and AI (parse/gifts/ask) |
| `requirements.txt` | Backend deps (`fastapi`, `httpx`) |
| `vercel.json` | Static hosting + `/api/*` → `api/index` rewrite |
| `supabase/schema.sql` | `user_state` table + Row-Level Security |
| `supabase/bank_schema.sql` | `connections` table (bank/Trading 212 secrets) + RLS |
| `privacy.html`, `terms.html` | Legal pages |

## Status

- **Working:** accounts, cloud sync, tasks, people/gifts, finance/budgets, documents
  & file uploads, themes, offline AI fallbacks, and — with the relevant keys set —
  live bank (Lunch Flow), Trading 212, and Claude AI.
- **One-time `.ics` export** works from Settings and per task.
- **Pending:** the live Apple Calendar **subscription feed** (`/api/feed`) isn't part
  of the current consolidated backend yet, so auto-refreshing subscriptions aren't
  served. Direct Trading 212 holdings sync requires connecting T212 with its own API
  key (see [`PHASE-B.md`](PHASE-B.md)).
