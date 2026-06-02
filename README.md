# Tend 🌱

A personal, AI-powered task manager — a to-do list you talk to in plain English.
Things-4-inspired, runs as a responsive web app + installable PWA (works on iPhone).

**Live:** https://claude-test1-tend.vercel.app

## Features

- **AI quick-add** — type *"buy mum a present by her birthday 15 jun, high #gift"* and
  it fills in the dates, priority, and tags (Claude when a key is set; smart offline
  parser otherwise).
- **Accounts** — email/password or Sign in with Google. Each person gets a private list.
- **Cloud sync** — your tasks follow you across every device you log in on.
- **Apple Calendar sync** — subscribe once; dated tasks appear in Apple Calendar and refresh automatically.
- Groups, important dates (birthdays/anniversaries with attached to-dos), rainy-day
  tasks, dual dates (scheduled + deadline), notes, subtasks, tags, calendar grid,
  weekly review, focus mode, dark mode.

## Tech

- Single-file React app (in-browser Babel) + static hosting — no build step.
- **Supabase** for auth + database (per-user row, Row-Level Security).
- **Vercel** serverless Python functions: `api/parse.py` (AI) and `api/feed.py` (calendar feed).

## Setup

- **Accounts + calendar:** see [`SETUP-ACCOUNTS.md`](SETUP-ACCOUNTS.md).
- **AI key (optional):** add `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables.
- **Run locally:** `python localdev.py` → http://localhost:4178 (local-only dev server; on Vercel the `api/*.py` serverless functions are used instead)

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Shell; loads React, Supabase, app |
| `app.jsx` | The whole app UI |
| `cloud.js` | Auth + cloud save/load |
| `config.js` | Public Supabase URL + anon key |
| `api/parse.py` | AI natural-language parsing |
| `api/feed.py` | Apple Calendar `.ics` feed |
| `supabase/schema.sql` | Database table + security |
