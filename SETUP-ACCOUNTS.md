# Tend — Accounts + Apple Calendar setup

This adds **login** (so you and your friend each have a private list, accessible
from any device) and **Apple Calendar sync**. It uses **Supabase** (free) for the
database + login.

Work top to bottom. It takes ~15 minutes. You can skip Part C (Google) at first
and use email/password right away.

---

## Part A — Create the Supabase project (~5 min)

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**:
   - **Name:** `tend`
   - **Database Password:** generate one and save it somewhere (you won't need it day-to-day).
   - **Region:** pick the one closest to you.
   - Click **Create new project** and wait ~2 min for it to provision.
3. **Create the table:** left sidebar → **SQL Editor** → **New query** → paste the
   entire contents of `supabase/schema.sql` from this project → click **Run**.
   You should see "Success. No rows returned."

## Part B — Get your keys and connect the app (~3 min)

1. In Supabase: **Project Settings** (gear, bottom-left) → **API**.
2. You'll see:
   - **Project URL** → e.g. `https://abcdefgh.supabase.co`
   - **Project API keys → `anon` `public`** → a long string.
   - **Project API keys → `service_role` `secret`** → a different long string. ⚠️ Keep this one secret.
3. **Edit `config.js`** in this project and paste the first two:
   ```js
   window.TEND_CONFIG = {
     SUPABASE_URL: "https://abcdefgh.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGc...the anon public key...",
   };
   ```
   (The anon key is safe to be public — Row-Level Security protects the data.)
4. **Add the secret key to Vercel** (for the calendar feed):
   - Vercel dashboard → your project → **Settings → Environment Variables**. Add **two**:
     | Key | Value |
     |---|---|
     | `SUPABASE_URL` | your Project URL (same as above) |
     | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role secret** key |
   - (If you've added your Anthropic key, leave it as-is.)

## Part C — Turn on logins

### Email/password (works immediately, zero setup)
In Supabase → **Authentication → Providers → Email** → make sure it's **enabled**
(it is by default). Done — you and your friend can sign up with email + password.

> Tip: Supabase sends a confirmation email by default. To skip that while testing,
> go to **Authentication → Providers → Email** and turn **Confirm email** off.

### Sign in with Google (optional, ~7 min)
1. **Supabase** → **Authentication → Providers → Google** → toggle **Enable**.
   Copy the **Callback URL** it shows (looks like
   `https://abcdefgh.supabase.co/auth/v1/callback`). Leave this tab open.
2. **Google Cloud Console** → https://console.cloud.google.com :
   - Create a project (or pick one) → top bar project picker → **New Project** → name it `tend`.
   - Search **"OAuth consent screen"** → **External** → fill app name `Tend`, your email → Save through the steps (you can leave most blank). Add yourself + your friend as **Test users**.
   - Search **"Credentials"** → **Create Credentials → OAuth client ID** →
     **Application type: Web application** →
     under **Authorized redirect URIs** click **Add URI** and paste the **Callback URL** from step 1 → **Create**.
   - Copy the **Client ID** and **Client secret**.
3. Back in **Supabase → Google provider**: paste the **Client ID** and **Client secret** → **Save**.
4. **Supabase → Authentication → URL Configuration**: set **Site URL** to your live
   Vercel URL (`https://claude-test1-tend.vercel.app`). Add it under **Redirect URLs** too.

---

## Part D — Deploy

Once `config.js` is filled in and the Vercel env vars are set, the changes are
already on GitHub, so just **redeploy**:
- Vercel → your project → **Deployments** → latest → **⋯ → Redeploy**.

Open your live URL — you'll get the **login screen**. Sign up, and your tasks now
save to the cloud and sync across every device you log in on.

---

## Part E — Apple Calendar sync

1. In the app: **Settings → Sync to Apple Calendar**.
2. **On iPhone:** tap **Subscribe in Apple Calendar** → **Add**. Your dated tasks
   now appear in the Calendar app and refresh automatically.
   (⚠️-marked events are hard deadlines.)
3. **On Mac:** click **Copy link**, then Calendar → **File → New Calendar
   Subscription** → paste → set auto-refresh to "Every hour".

> The calendar link is private to each user — don't share it.
> Sync is one-way: tasks flow Tend → Apple Calendar. Manage tasks in Tend.

---

## How it all fits together

- `config.js` — public Supabase URL + anon key (front-end login/data).
- `cloud.js` — login + per-user cloud save/load, with offline cache.
- `supabase/schema.sql` — the `user_state` table + Row-Level Security (privacy).
- `api/feed.py` — serverless feed that turns your tasks into a live `.ics`.
- Vercel env vars — your **secret** service-role key (calendar) + Anthropic key (AI).

Your data is private per account: Row-Level Security means even though you share
the same database, neither of you can read the other's tasks.
