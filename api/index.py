"""
Tend Phase-B API — runs ON VERCEL as a Python serverless function.

Everything lives in this ONE file (Vercel serves it at  https://<your-site>/api/... ).
It connects:
  • UK/EU banks (Lloyds, …) — Open Banking via Lunch Flow (read-only API key)
  • Trading 212             — official read-only Invest API

The browser calls this with the signed-in user's Supabase access token; the
Lunch Flow and Trading 212 API keys are kept in the Supabase `connections`
table (written only with the service-role key) and NEVER sent to the browser.

Set these as Environment Variables in your Vercel project (Settings → Environment
Variables) — never in config.js:
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
  APP_URL (e.g. https://claude-test1-tend.vercel.app),
  T212_MODE (optional, "live"/"demo")
The Lunch Flow + Trading 212 keys are pasted in-app by the user, not set here.

Vercel serves the ASGI `app` below; the vercel.json rewrite sends every
/api/* request here. Routes are therefore defined WITH the /api prefix.
"""
import os
import base64
import traceback
import datetime as dt
from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

APP_URL = os.environ.get("APP_URL", "http://localhost:4178").rstrip("/")
T212_MODE = os.environ.get("T212_MODE", "live")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
# Accept either name — people commonly call this SUPABASE_SERVICE_ROLE_KEY.
SUPABASE_SERVICE_KEY = (os.environ.get("SUPABASE_SERVICE_KEY")
                        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
# ── Lunch Flow (UK/EU Open Banking aggregator — holds the AISP licence) ────────
# The user connects their banks inside Lunch Flow's own widget, then pastes a
# single read-only API key into Tend. We pull accounts + transactions with it.
# NB the canonical host is www.lunchflow.app — the bare host 308-redirects with a
# custom JSON body that isn't a standard redirect, so point straight at www.
LUNCHFLOW_BASE = os.environ.get("LUNCHFLOW_API_BASE", "https://www.lunchflow.app/api/v1").rstrip("/")

T212_BASE = (os.environ.get("T212_API_BASE")
             or ("https://demo.trading212.com/api/v0" if T212_MODE == "demo"
                 else "https://live.trading212.com/api/v0"))

app = FastAPI(title="Tend Phase-B API")
app.add_middleware(CORSMiddleware, allow_origins=[APP_URL, "http://localhost:4178"],
                   allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    # Never leak a bare "Internal Server Error" — return the real reason so the
    # in-app message is actionable (the front-end reads `detail`). Include the
    # throwing location to make diagnosis quick.
    tb = traceback.extract_tb(exc.__traceback__)
    ours = [f for f in tb if f.filename.endswith("index.py")]
    frames = ours[-2:] or tb[-2:]
    where = " <- ".join(f"{f.name}:{f.lineno}" for f in frames) if frames else "?"
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc} [{where}]"})


# ── Supabase helpers (verify the caller; store secrets server-side) ───────────
class AuthError(Exception):
    pass


async def verify_user(token: str) -> str:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_URL / SUPABASE_ANON_KEY not set in Vercel")
    if not token:
        raise AuthError("Missing token")
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                            headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY})
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Supabase: {e}")
    if r.status_code != 200:
        raise AuthError("Invalid or expired session")
    try:
        return r.json()["id"]
    except Exception:
        raise AuthError("Unexpected response from Supabase auth")


async def current_user(authorization: Optional[str]) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        return await verify_user(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


def _svc():
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: SUPABASE_SERVICE_KEY not set in Vercel")
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


def _db_ok(r, action):
    # 404 / "PGRST205" = the `connections` table doesn't exist (SQL not run);
    # 401 / 403 = bad service key. Surface a real reason instead of a bare 500.
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Supabase {action} failed ({r.status_code}): {r.text[:200]}")


async def db_get(filters: dict):
    # Filters are passed as encoded query params (httpx percent-encodes the
    # values) so untrusted input can never inject extra PostgREST operators.
    params = {**filters, "select": "*"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/connections", headers=_svc(), params=params)
    _db_ok(r, "read")
    return r.json() if r.content else []


async def db_upsert(user_id: str, provider: str, fields: dict):
    body = {"user_id": user_id, "provider": provider, "updated_at": "now()", **fields}
    headers = {**_svc(), "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=representation"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/connections?on_conflict=user_id,provider",
                         headers=headers, json=body)
    _db_ok(r, "write")
    return r.json() if r.content else []


async def db_delete(user_id: str, provider: str):
    async with httpx.AsyncClient(timeout=15) as c:
        await c.delete(f"{SUPABASE_URL}/rest/v1/connections", headers=_svc(),
                       params={"user_id": f"eq.{user_id}", "provider": f"eq.{provider}"})


# ── Lunch Flow (Lloyds + any UK/EU bank the user links inside Lunch Flow) ──────
async def lunchflow_get(api_key: str, path: str):
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        r = await c.get(f"{LUNCHFLOW_BASE}{path}",
                        headers={"x-api-key": api_key, "Accept": "application/json"})
    if r.status_code in (401, 403):
        raise HTTPException(status_code=400, detail="Invalid Lunch Flow API key")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Lunch Flow rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Lunch Flow {path} → {r.status_code}: {r.text[:160]}")
    if not r.content:
        return {}
    try:
        return r.json()
    except Exception:
        # Non-JSON (e.g. an HTML page) means the URL/route is wrong — show what
        # came back so we can fix the base URL or path.
        ct = r.headers.get("content-type", "?")
        raise HTTPException(status_code=502,
                            detail=f"Lunch Flow {path} returned non-JSON [{ct}] at {LUNCHFLOW_BASE}: {r.text[:160]}")


def _lf_list(data, *keys):
    # Lunch Flow may return a bare array or wrap it ({data|accounts|transactions: [...]}).
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in keys:
            if isinstance(data.get(k), list):
                return data[k]
    return []


def _lf_first(d, *keys, default=None):
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d[k]
    return default


# ── Trading 212 ───────────────────────────────────────────────────────────────
# T212's Public API authenticates with HTTP Basic auth: API Key ID as the user,
# Secret Key as the password, Base64("id:secret") in the Authorization header.
async def t212_get(key_id: str, secret: str, path: str):
    token = base64.b64encode(f"{key_id}:{secret}".encode()).decode()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{T212_BASE}{path}", headers={"Authorization": f"Basic {token}"})
    if r.status_code == 401:
        raise HTTPException(status_code=400, detail="Invalid Trading 212 API key or secret")
    if r.status_code == 403:
        raise HTTPException(status_code=400, detail="Trading 212 key is missing the required read permission (enable Account data + Portfolio)")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Trading 212 rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Trading 212 {path} → {r.status_code}: {r.text[:160]}")
    return r.json() if r.content else {}


# ── Routes (all under /api) ───────────────────────────────────────────────────
@app.get("/api")
@app.get("/api/")
def health():
    return {"ok": True, "service": "tend-phase-b", "providers": ["lunchflow", "t212"]}


@app.get("/api/connections")
async def connections(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    out = []
    for c in await db_get({"user_id": f"eq.{uid}"}):
        out.append({"provider": c.get("provider"),
                    "display_name": c.get("display_name") or c.get("provider"),
                    "kind": "t212" if c.get("provider") == "t212" else "bank",
                    "connected": bool(c.get("session_id") or c.get("api_key")),
                    "accounts": len(c.get("accounts") or []) if c.get("accounts") else None})
    return {"connections": out}


@app.post("/api/bank/connect")
async def bank_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    # The user connects their banks inside Lunch Flow, then pastes its read-only
    # API key here. We validate it by listing accounts and store it server-side.
    uid = await current_user(authorization)
    api_key = (body or {}).get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing api_key")
    accts = _lf_list(await lunchflow_get(api_key, "/accounts"), "accounts", "data")  # validates the key
    await db_upsert(uid, "lunchflow", {
        "display_name": "Lunch Flow", "api_key": api_key, "accounts": accts,
        "session_id": None, "state": None, "aspsp": None, "authorization_id": None})
    return {"ok": True, "accounts": len(accts)}


@app.get("/api/bank/transactions")
async def bank_transactions(days: int = 90, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    start = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.lunchflow"})
    if not rows or not rows[0].get("api_key"):
        return {"transactions": []}
    key = rows[0]["api_key"]
    out = []
    for a in _lf_list(await lunchflow_get(key, "/accounts"), "accounts", "data"):
        aid = _lf_first(a, "id", "account_id", "accountId", "uid")
        if not aid:
            continue
        bank_name = _lf_first(a, "institution", "institution_name", "bank", "name", default="Bank")
        try:
            data = await lunchflow_get(key, f"/accounts/{aid}/transactions")
        except HTTPException:
            continue
        for t in _lf_list(data, "transactions", "data"):
            date_s = str(_lf_first(t, "date", "booking_date", "bookingDate", "timestamp", "made_on", default=start))[:10]
            if date_s < start:
                continue
            value = float(_lf_first(t, "amount", "value", default=0) or 0)
            desc = _lf_first(t, "description", "merchant", "merchant_name", "name", "payee", "counterparty", default="Transaction")
            # Direction if given, else sign. Aggregators usually use negative = money out.
            direction = str(_lf_first(t, "direction", "type", "kind", default="")).lower()
            if direction in ("debit", "outflow", "out", "spend"):
                typ = "spend"
            elif direction in ("credit", "inflow", "in", "income"):
                typ = "income"
            else:
                typ = "income" if value > 0 else "spend"
            out.append({"date": date_s, "amount": abs(value), "type": typ,
                        "description": desc, "source": "bank", "bank": bank_name})
    return {"transactions": out}


@app.get("/api/bank/accounts")
async def bank_accounts(authorization: Optional[str] = Header(default=None)):
    # The accounts Lunch Flow exposes for the linked banks, with balances. Lets the
    # app show which accounts are actually visible over Open Banking (some bank
    # savings products aren't shared) and populate balances into the accounts pages.
    uid = await current_user(authorization)
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.lunchflow"})
    if not rows or not rows[0].get("api_key"):
        return {"accounts": []}
    key = rows[0]["api_key"]
    out = []
    for a in _lf_list(await lunchflow_get(key, "/accounts"), "accounts", "data"):
        aid = _lf_first(a, "id", "account_id", "accountId", "uid", default="")
        name = _lf_first(a, "name", "display_name", "nickname", "account_name", default="Account")
        # The /accounts list carries no balances — fetch each from the per-account
        # balance endpoint, which returns {"balance": {"amount": N, "currency": ...}}.
        bal, ccy = None, "GBP"
        if aid != "":
            try:
                b = (await lunchflow_get(key, f"/accounts/{aid}/balance")) or {}
                node = b.get("balance") if isinstance(b.get("balance"), dict) else b
                amt = _lf_first(node, "amount", "value", "balance", default=None)
                bal = round(float(amt), 2) if amt is not None else None
                ccy = _lf_first(node, "currency", "iso_currency_code", "currency_code", default="GBP")
            except (HTTPException, TypeError, ValueError):
                bal = None
        # No type in the list either — infer one from the name so the app can pick
        # the right icon and route the balance to savings/debts/current on import.
        atype = str(_lf_first(a, "type", "account_type", "subtype", "category", "class", default="")).lower()
        if not atype:
            n = name.lower()
            if any(w in n for w in ("credit", "loan", "mortgage", "card")):
                atype = "credit"
            elif any(w in n for w in ("saving", "saver", "isa", "fund", "emergency")):
                atype = "savings"
        out.append({
            "id": aid,
            "name": name,
            "institution": _lf_first(a, "institution", "institution_name", "bank", "provider", default=""),
            "type": atype,
            "currency": ccy,
            "balance": bal,
        })
    return {"accounts": out}


@app.post("/api/bank/disconnect")
async def bank_disconnect(bank: str = "lunchflow", authorization: Optional[str] = Header(default=None)):
    # Drops the stored Lunch Flow key. The bank links themselves live in Lunch
    # Flow and are managed there.
    uid = await current_user(authorization)
    await db_delete(uid, "lunchflow")
    return {"ok": True}


@app.post("/api/t212/connect")
async def t212_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    key_id = (body or {}).get("api_key", "").strip()
    secret = (body or {}).get("api_secret", "").strip()
    if not key_id or not secret:
        raise HTTPException(status_code=400, detail="Missing API key ID or secret")
    await t212_get(key_id, secret, "/equity/account/summary")  # validates the pair
    # Key id in api_key; secret kept in the server-only meta jsonb (RLS denies browser).
    await db_upsert(uid, "t212", {"display_name": "Trading 212", "api_key": key_id,
                                  "meta": {"api_secret": secret}})
    return {"ok": True}


@app.get("/api/t212/portfolio")
async def t212_portfolio(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    rows = await db_get({"user_id": f"eq.{uid}", "provider": "eq.t212"})
    if not rows or not rows[0].get("api_key"):
        raise HTTPException(status_code=404, detail="Trading 212 not connected")
    key_id = rows[0]["api_key"]
    secret = (rows[0].get("meta") or {}).get("api_secret", "")
    summary = await t212_get(key_id, secret, "/equity/account/summary")
    positions = await t212_get(key_id, secret, "/equity/positions")
    holdings = []
    for p in (positions or []):
        inst = p.get("instrument") or {}
        wallet = p.get("walletImpact") or {}
        qty = float(p.get("quantity", 0) or 0)
        price = float(p.get("currentPrice", 0) or 0)
        holdings.append({"ticker": inst.get("ticker", "") or inst.get("name", ""),
                         "name": inst.get("name", ""), "units": qty, "price": price,
                         "avgCost": float(p.get("averagePricePaid", 0) or 0),
                         "value": round(float(wallet.get("currentValue", qty * price) or 0), 2),
                         "ppl": round(float(wallet.get("unrealizedProfitLoss", 0) or 0), 2),
                         "source": "t212"})
    cash = (summary or {}).get("cash") or {}
    inv = (summary or {}).get("investments") or {}
    return {"cash": round(float(cash.get("availableToTrade", 0) or 0), 2),
            "invested": round(float(inv.get("totalCost", 0) or 0), 2),
            "result": round(float(inv.get("unrealizedProfitLoss", 0) or 0), 2),
            "total": round(float((summary or {}).get("totalValue", 0) or 0), 2),
            "holdings": holdings}


@app.post("/api/t212/disconnect")
async def t212_disconnect(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    await db_delete(uid, "t212")
    return {"ok": True}
