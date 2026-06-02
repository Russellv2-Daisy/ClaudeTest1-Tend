# Hosting Tend 🌱

Your app has two parts:

- **Frontend** — the whole app (`index.html`, `app.jsx`, `vendor/`, `manifest.webmanifest`, `icon.svg`). Stores your tasks in the browser (localStorage). Needs only a *static* host.
- **AI backend** — `server.py`, which exposes `/api/parse` and keeps your Anthropic API key secret. Needs a host that can run **Python** (or a serverless function).

Pick the path that matches what you want.

---

## Path A — Full app with real Claude AI  ⭐ recommended

Host the Python server so AI quick-add uses Claude. Easiest free option: **Render**.

1. **Get an Anthropic API key** → https://console.anthropic.com/ → *API Keys* → create one (starts with `sk-ant-`). Add a few dollars of credit.
2. **Put this folder on GitHub:**
   - Make a free account at github.com.
   - Create a new repo (e.g. `tend`), then upload this whole folder (drag-and-drop in the browser works, or use Git).
   - ⚠️ Do **not** upload `.env` — it's already in `.gitignore`. Your key goes in the host dashboard instead (step 4).
3. **Create the service on Render:**
   - Sign up at https://render.com (free).
   - **New + → Blueprint** → connect GitHub → pick your `tend` repo.
   - Render reads `render.yaml` automatically and configures everything.
4. **Add your key:** when prompted (or under the service's **Environment** tab), set
   `ANTHROPIC_API_KEY` = your `sk-ant-...` key. Save.
5. **Deploy.** In ~1 minute you get a URL like `https://tend.onrender.com` (HTTPS included).

> Render's free tier sleeps after 15 min idle; the first visit then takes ~30s to wake. Fine for personal use. Paid tier ($7/mo) stays awake.

**Other hosts that work the same way** (all read `Procfile`/`render.yaml`): Railway, Fly.io, Heroku, PythonAnywhere, or any small VPS.

---

## Path B — Free static-only (no server, AI uses offline fallback)

If you don't want a backend, host just the files. AI quick-add still works via the
built-in local parser (it reads dates, priority `high/med/low`, and `#tags`) — it's
just not as smart as Claude, and there's no monthly cost ever.

Easiest options (all free, give you HTTPS — required for iPhone install):

- **Netlify Drop:** go to https://app.netlify.com/drop and drag this folder in. Done.
- **GitHub Pages:** push to GitHub → repo **Settings → Pages** → deploy from `main`.
- **Cloudflare Pages / Vercel:** connect the repo; framework preset = "None / static".

That's it — no `server.py` needed for this path.

---

## Add to your iPhone (either path)

1. Open your new HTTPS URL in **Safari** on the iPhone.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Launch it from the home screen — it runs full-screen like a native app, works offline,
   and your tasks are saved on the device.

---

## Run it locally (on this PC)

```
python server.py
```
Then open http://localhost:4178. To enable Claude locally, put your key in `.env`:
```
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## ⚠️ Important: where your data lives

Tasks are stored in the **browser's localStorage on each device** — there's no shared
database, so your phone and laptop won't sync, and clearing browser data wipes tasks.
For one person on one device this is simple and private. If you later want cross-device
sync, that's the main upgrade to plan for (a small database + the existing AI backend).
