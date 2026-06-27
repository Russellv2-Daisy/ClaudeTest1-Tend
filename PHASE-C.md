# Tend — Phase C, D & E plan

This is the locked plan for the final development cycle. Phase B (live bank + Trading
212 + AI) is on (`config.js → BACKEND_URL: "/api"`). Phase C below adds the remaining
integrations; Phase D is a full logic + security pass; Phase E is the iPhone move.

Status key: ✅ done · 🟡 partial / needs deploy verification · ⬜ planned

---

## Phase C — integrations

### C1 · Credit-card accuracy & interest (✅ done — was Phase B finish)
- UK card APRs are the **effective** (compounded) annual rate, so the monthly periodic
  rate is `(1+APR)^(1/12) − 1`, **not** `APR/12`. The old `APR/12` overstated interest
  (34.9% Capital One: 2.53%/mo, not 2.91%). Fixed in `cardMonthlyRate` / `cardMonthlyInterest`.
- Added `cardMinPayment` (Capital One UK rule: greater of £25 or 1% of balance + interest;
  full balance if under £25) and `cardPayoff` (declining-minimum simulation).
- Cards now show: compounded interest/mo, estimated minimum, the legally-required
  **"minimum-only: X to clear, £Y interest"** warning, and **utilisation %** (needs the
  new per-card credit-limit field).
- Budget commitments now fall back to the estimated card minimum when none is entered.

### C2 · Credit score (✅ done, 🟡 live pull later)
- New `CreditScorePanel`: pick CRA (Experian 0–999 / Equifax 0–1000 / TransUnion 0–710,
  real band thresholds), log your score each month → trend chart builds, see current vs
  previous delta.
- **Recommendations engine** (`creditInsights`) — personalised from real Tend data:
  utilisation (overall + per-maxed-card), most-expensive APR, plus evergreen UK levers
  (never miss a payment, electoral roll, space out applications, keep oldest account).
- ✅ **AI report import (the practical "auto" route):** `POST /api/credit` (owner-gated)
  takes pasted report text **or** a PDF (sent to Claude as a document block) and returns
  `{provider, score, previousScore, factors[]}` — clamped/validated server-side so a bad
  parse can't write junk. `CreditScorePanel` → ✦ Import from report applies it: logs the
  score (and previousScore to last month, so the delta + trend are instant) and shows a
  "What your report says" factor grid (good/fair/poor). `state.credit = { provider,
  history:[{month,score}], factors[], factorsAt }`.
- ⬜ **Live soft-search pull:** no free first-party UK CRA API exists for individuals
  (ClearScore/Credit Karma have no public API; CRA commercial APIs need a business + FCA
  agreement). The AI import above is the deliberate interim — no third party pulls the file.

### C3 · Investments auto-population (✅ done)
- Holdings now render as **auto-populated info squares** (grid): name/ticker, market value,
  gain/loss £ + % with trend bar, units, price, avg cost, invested, and a **● LIVE** badge +
  synced date for Trading-212-sourced holdings.
- Sync now keeps the instrument **name** and live **unrealised P/L (`ppl`)** from the API.
- ⬜ Possible extras the T212 API can give later: per-holding day change, dividends,
  pies/auto-invest breakdown, FX. Add as more squares when needed.

### C4 · Claude API overview on the connect screen (✅ done)
- Card on the bank/connections screen explaining Tend runs on Claude, the three gated
  features (Quick Add → Haiku, Gifts → Haiku, Ask → Opus), live/dormant status, and the
  allow-list security model.

### C5 · Move connect-bank into Settings (✅ done)
- Removed **Connect bank** from the Finance tab bar. Added **Settings → 🏦 Bank &
  connections** which deep-links to the existing connect panel (App holds `financeTab`;
  `goFinanceTab("connect")` from Settings; FinanceView consumes `initialTab` then clears it
  so normal Finance visits still land on Dashboard).

### C6 · Apple Calendar feed (🟡 implemented — verify on deploy)
- **Bug found & fixed:** Settings advertised `webcal://…/api/feed?token=…` but **no
  `/api/feed` route existed** — the subscription 404'd. Implemented `GET /api/feed` in
  `api/index.py`: looks up the user by `calendar_token` (service key), emits a valid
  RFC-5545 `text/calendar` with all-day VEVENTs for open tasks (deadline/scheduled) and
  yearly/interval RRULEs for important dates. Auth = the unguessable token (standard feed
  model; read-only, single user). Refreshes ~every 6h (Apple controls cadence).
- Verify after deploy: open `…/api/feed?token=<yours>` → downloads `tend.ics`; subscribe in
  Apple Calendar via the webcal link in Settings.

### C7 · Finance reconciliation / data check (✅ done)
- **Root cause of "home says £353 but my debit shows £171":** duplicate account rows. The
  importer matched only by name (the F9 trade-off), so a manual entry + a bank-linked entry
  (or a re-import whose name changed) both counted toward the totals.
- Added `financeAudit(state)` (pure): flags duplicate rows within a bucket and the same name
  across buckets, returning the offending items. Surfaced as a **⚠️ Data check** card at the
  top of Banking (per-row **Remove**, keeps the data safe — only removes the Tend row) and a
  one-line pointer on the Home money snapshot.
- **Prevention:** `doImportBalances` now matches on the bank's **stable account id**
  (`extId`) first, name as fallback, so re-imports update the same row instead of duplicating.
- Verified live: two "Lloyds Current" rows (£171 + £182 = £353) → flagged → Remove → home
  "In the bank" corrects to £171.

### C8 · Visual upgrades — premium, data-accurate charts (✅ done)
- New reusable `AreaTrend` SVG component: smooth Catmull-Rom curve, gradient fill, a
  self-drawing line + pulsing latest-point marker (keyframes in index.html), and a hover
  layer that reads out each point. Measures its container and draws at real pixels (round
  markers, crisp text, correct hover) — **not** `preserveAspectRatio="none"` which stretches.
- Used for: **Net worth over time** (Finance dashboard, 12 mo) and **Credit score over time**.
- Net-worth card also gains an **asset-mix** stacked bar (current/savings/investments/
  pensions %), and the **Home** money snapshot gains a net-worth **sparkline** with the
  period change. Every value is real state data; charts only show with ≥2 real data points.
- Verified live (seeded then cleared 8 months of history): curve, gradient, animation,
  hover-tracking and auto-scaling all correct; totals reconcile (£10,782 = 1542+6000+3240).

---

## Phase D — full logic check + security review (⬜ — may merge with B)
- **Logic:** re-verify finance maths end-to-end (budget roll-ups, net worth, pay-period
  ranges, card vs loan interest conventions, payoff ordering), date/timezone handling
  (`ymdLocal`, leap-year birthdays), and import de-duplication.
- **Security review (run `/security-review` on the branch):**
  - `api/index.py`: every route scopes to the caller's `uid`; `/api/feed` is token-only by
    design — confirm the token is high-entropy and not logged. No service key or provider
    key ever reaches the browser.
  - Supabase RLS on `user_state` + `connections` (connections: server-write only).
  - AI routes gated by session **and** `AI_ALLOWED_EMAILS` so visitors can't spend credits.
  - PostgREST filters are param-encoded (no operator injection). CSP / no secrets in
    `config.js`. Check that a bad token can't enumerate users (constant 404) and that the
    feed sets a correct `text/calendar` content-type.

---

## Phase E — iPhone

- **Already works:** Tend is a PWA — *Add to Home Screen* (manifest + icon) gives an app
  icon and standalone launch on iOS.
- **True home-screen widget:** iOS does **not** let a PWA publish a WidgetKit widget. Two
  routes:
  1. **Interim (no native app) — ✅ BUILT:** `GET /api/widget?token=` returns a read-only
     JSON summary (net worth, in-the-bank, today's tasks, overdue count, next date), authed
     by the same per-user calendar token as `/api/feed`. `scriptable-widget.js` (repo root)
     is the widget script the user pastes into the free **Scriptable** app; Settings → 📱
     iPhone widget surfaces the personal URL + setup steps. Only sums/dates are computed
     server-side (no budget math) so it can't diverge from the app. Verify on deploy.
  2. **Native (Phase E proper):** wrap/rebuild as a native shell (React Native / Capacitor,
     or Swift) and ship a WidgetKit extension. Required for a first-class widget, Face-ID
     lock, notifications, and App Store presence — only if Tend graduates beyond personal use.
