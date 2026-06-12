"""
Tend Phase-B API — runs ON VERCEL as a Python serverless function.

Everything lives in this ONE file (Vercel serves it at  https://<your-site>/api/... ).
It connects:
  • Lloyds UK + Chase UK  — Open Banking via Enable Banking
  • Trading 212           — official read-only Invest API

The browser calls this with the signed-in user's Supabase access token; bank
session ids and the Trading 212 key are kept in the Supabase `connections`
table (written only with the service-role key) and NEVER sent to the browser.

Set these as Environment Variables in your Vercel project (Settings → Environment
Variables) — never in config.js:
  ENABLE_APPLICATION_ID, ENABLE_PRIVATE_KEY,
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
  APP_URL (e.g. https://claude-test1-tend.vercel.app),
  ACCESS_VALID_DAYS (optional, default 90), T212_MODE (optional, "live"/"demo")

Vercel serves the ASGI `app` below; the vercel.json rewrite sends every
/api/* request here. Routes are therefore defined WITH the /api prefix.
"""
import os
import time
import uuid
import datetime as dt
from typing import Optional

import jwt          # PyJWT
import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

APP_URL = os.environ.get("APP_URL", "http://localhost:4178").rstrip("/")
VALID_DAYS = int(os.environ.get("ACCESS_VALID_DAYS", "90"))
T212_MODE = os.environ.get("T212_MODE", "live")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
EB_API = os.environ.get("ENABLE_API_BASE", "https://api.enablebanking.com").rstrip("/")
T212_BASE = (os.environ.get("T212_API_BASE")
             or ("https://demo.trading212.com/api/v0" if T212_MODE == "demo"
                 else "https://live.trading212.com/api/v0"))

# Short provider key -> the name Enable Banking lists the bank under (GB).
# If Chase shows as "Chase UK" in GET /aspsps?country=GB, change "Chase" here.
OPEN_BANKING = {"lloyds": "Lloyds", "chase": "Chase"}

app = FastAPI(title="Tend Phase-B API")
app.add_middleware(CORSMiddleware, allow_origins=[APP_URL, "http://localhost:4178"],
                   allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


# ── Supabase helpers (verify the caller; store secrets server-side) ───────────
class AuthError(Exception):
    pass


async def verify_user(token: str) -> str:
    if not token:
        raise AuthError("Missing token")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                        headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY})
    if r.status_code != 200:
        raise AuthError("Invalid or expired session")
    return r.json()["id"]


async def current_user(authorization: Optional[str]) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        return await verify_user(token)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


def _svc():
    return {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


async def db_get(query: str):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/connections?{query}&select=*", headers=_svc())
    r.raise_for_status()
    return r.json()


async def db_upsert(user_id: str, provider: str, fields: dict):
    body = {"user_id": user_id, "provider": provider, "updated_at": "now()", **fields}
    headers = {**_svc(), "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=representation"}
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(f"{SUPABASE_URL}/rest/v1/connections?on_conflict=user_id,provider",
                         headers=headers, json=body)
    r.raise_for_status()
    return r.json()


async def db_delete(user_id: str, provider: str):
    async with httpx.AsyncClient(timeout=15) as c:
        await c.delete(f"{SUPABASE_URL}/rest/v1/connections?user_id=eq.{user_id}&provider=eq.{provider}",
                       headers=_svc())


# ── Enable Banking (Lloyds + Chase) ───────────────────────────────────────────
def eb_jwt() -> str:
    app_id = os.environ.get("ENABLE_APPLICATION_ID", "")
    key = os.environ.get("ENABLE_PRIVATE_KEY", "").replace("\\n", "\n")
    if not app_id or not key:
        raise HTTPException(status_code=500, detail="Enable Banking not configured")
    now = int(time.time())
    payload = {"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 3600}
    return jwt.encode(payload, key, algorithm="RS256", headers={"typ": "JWT", "alg": "RS256", "kid": app_id})


async def eb(method: str, path: str, **kw):
    headers = {"Authorization": f"Bearer {eb_jwt()}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(method, f"{EB_API}{path}", headers=headers, **kw)
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Enable Banking {path} → {r.status_code}: {r.text[:200]}")
    return r.json() if r.content else {}


async def eb_find_aspsp(name: str):
    data = await eb("GET", "/aspsps?country=GB")
    for a in data.get("aspsps", data if isinstance(data, list) else []):
        if name.lower() in (a.get("name", "").lower()):
            return a
    raise HTTPException(status_code=502, detail=f"Bank '{name}' not found at Enable Banking")


def _acct_uid(a):
    return a if isinstance(a, str) else (a.get("uid") or a.get("account_uid") or a.get("id"))


# ── Trading 212 ───────────────────────────────────────────────────────────────
async def t212_get(api_key: str, path: str):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{T212_BASE}{path}", headers={"Authorization": api_key})
    if r.status_code == 401:
        raise HTTPException(status_code=400, detail="Invalid Trading 212 API key")
    if r.status_code == 429:
        raise HTTPException(status_code=429, detail="Trading 212 rate limit — try again shortly")
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Trading 212 {path} → {r.status_code}")
    return r.json() if r.content else {}


# ── Routes (all under /api) ───────────────────────────────────────────────────
@app.get("/api")
@app.get("/api/")
def health():
    return {"ok": True, "service": "tend-phase-b", "providers": list(OPEN_BANKING) + ["t212"]}


@app.get("/api/connections")
async def connections(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    out = []
    for c in await db_get(f"user_id=eq.{uid}"):
        out.append({"provider": c.get("provider"),
                    "display_name": c.get("display_name") or c.get("provider"),
                    "connected": bool(c.get("session_id") or c.get("api_key")),
                    "accounts": len(c.get("accounts") or []) if c.get("accounts") else None})
    return {"connections": out}


@app.post("/api/bank/auth")
async def bank_auth(bank: str = "lloyds", authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    name = OPEN_BANKING.get(bank)
    if not name:
        raise HTTPException(status_code=400, detail=f"Unknown bank '{bank}'")
    state = uuid.uuid4().hex
    valid_until = (dt.datetime.utcnow() + dt.timedelta(days=VALID_DAYS)).replace(microsecond=0).isoformat() + "Z"
    aspsp = await eb_find_aspsp(name)
    res = await eb("POST", "/auth", json={
        "access": {"valid_until": valid_until},
        "aspsp": {"name": aspsp["name"], "country": aspsp.get("country", "GB")},
        "state": state, "redirect_url": f"{APP_URL}/api/bank/callback", "psu_type": "personal"})
    await db_upsert(uid, bank, {"display_name": name, "state": state,
                                "authorization_id": res.get("authorization_id"),
                                "aspsp": aspsp, "session_id": None, "accounts": None})
    return {"url": res.get("url")}


@app.get("/api/bank/callback")
async def bank_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error or not code or not state:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    rows = await db_get(f"state=eq.{state}")
    if not rows:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    conn = rows[0]
    try:
        session = await eb("POST", "/sessions", json={"code": code})
    except HTTPException:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    await db_upsert(conn["user_id"], conn["provider"], {
        "session_id": session.get("session_id"), "accounts": session.get("accounts"),
        "aspsp": session.get("aspsp", conn.get("aspsp")), "state": None})
    return RedirectResponse(f"{APP_URL}/?bank=connected&provider={conn['provider']}")


@app.get("/api/bank/transactions")
async def bank_transactions(days: int = 90, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    date_from = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    out = []
    for conn in await db_get(f"user_id=eq.{uid}"):
        if conn.get("provider") not in OPEN_BANKING or not conn.get("session_id"):
            continue
        bank_name = conn.get("display_name") or conn.get("provider")
        for a in (conn.get("accounts") or []):
            acct = _acct_uid(a)
            if not acct:
                continue
            try:
                data = await eb("GET", f"/accounts/{acct}/transactions?date_from={date_from}")
            except HTTPException:
                continue
            for t in data.get("transactions", []):
                amt = t.get("transaction_amount", {}) or t.get("amount", {})
                value = float(amt.get("amount", 0) or 0)
                credit = (t.get("credit_debit_indicator") or "").upper() == "CRDT"
                out.append({
                    "date": (t.get("booking_date") or t.get("value_date") or date_from)[:10],
                    "amount": abs(value), "type": "income" if credit else "spend",
                    "description": (t.get("creditor", {}) or {}).get("name")
                    or (t.get("debtor", {}) or {}).get("name")
                    or " ".join(t.get("remittance_information", []) or []) or "Transaction",
                    "source": "bank", "bank": bank_name})
    return {"transactions": out}


@app.post("/api/bank/disconnect")
async def bank_disconnect(bank: str, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    await db_delete(uid, bank)
    return {"ok": True}


@app.post("/api/t212/connect")
async def t212_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    api_key = (body or {}).get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing api_key")
    await t212_get(api_key, "/equity/account/info")  # validates the key
    await db_upsert(uid, "t212", {"display_name": "Trading 212", "api_key": api_key})
    return {"ok": True}


@app.get("/api/t212/portfolio")
async def t212_portfolio(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    rows = await db_get(f"user_id=eq.{uid}&provider=eq.t212")
    if not rows or not rows[0].get("api_key"):
        raise HTTPException(status_code=404, detail="Trading 212 not connected")
    key = rows[0]["api_key"]
    cash = await t212_get(key, "/equity/account/cash")
    positions = await t212_get(key, "/equity/portfolio")
    holdings = []
    for p in (positions or []):
        qty = float(p.get("quantity", 0) or 0)
        price = float(p.get("currentPrice", 0) or 0)
        holdings.append({"ticker": p.get("ticker", ""), "units": qty, "price": price,
                         "avgCost": float(p.get("averagePrice", 0) or 0),
                         "value": round(qty * price, 2), "ppl": round(float(p.get("ppl", 0) or 0), 2),
                         "source": "t212"})
    return {"cash": round(float((cash or {}).get("free", 0) or 0), 2),
            "invested": round(float((cash or {}).get("invested", 0) or 0), 2),
            "result": round(float((cash or {}).get("result", 0) or 0), 2),
            "total": round(float((cash or {}).get("total", 0) or 0), 2),
            "holdings": holdings}


@app.post("/api/t212/disconnect")
async def t212_disconnect(authorization: Optional[str] = Header(default=None)):
    uid = await current_user(authorization)
    await db_delete(uid, "t212")
    return {"ok": True}
