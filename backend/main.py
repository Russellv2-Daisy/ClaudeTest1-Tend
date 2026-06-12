"""
Tend Phase-B backend — live bank + investment data for the static front-end.

Providers:
  • Lloyds UK  (Open Banking via Enable Banking)
  • Chase UK   (Open Banking via Enable Banking)
  • Trading 212 (official Invest API)

Runs as a standalone service (e.g. Render). The static site calls it with the
signed-in user's Supabase access token; bank session ids and the T212 API key
stay here in the Supabase `connections` table, never in the browser.

Environment variables (set on the host):
  ENABLE_APPLICATION_ID   Enable Banking application id (JWT `kid`)
  ENABLE_PRIVATE_KEY      Enable Banking RSA private key (PEM; \n-escaped ok)
  SUPABASE_URL            e.g. https://xxxx.supabase.co
  SUPABASE_ANON_KEY       public anon key (to verify user tokens)
  SUPABASE_SERVICE_KEY    secret service-role key (server-only)
  APP_URL                 the front-end origin, e.g. https://claude-test1-tend.vercel.app
  BACKEND_URL             this service's public URL, e.g. https://tend-bank.onrender.com
  ACCESS_VALID_DAYS       optional, Open Banking consent length in days (default 90)
  T212_MODE               optional, "live" (default) or "demo"
"""
import os
import uuid
import datetime as dt
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from enable_banking import EnableBanking, EnableBankingError
from trading212 import Trading212, Trading212Error
import supabase_store as store

APP_URL = os.environ.get("APP_URL", "http://localhost:4178").rstrip("/")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000").rstrip("/")
VALID_DAYS = int(os.environ.get("ACCESS_VALID_DAYS", "90"))
T212_MODE = os.environ.get("T212_MODE", "live")

# Map our short provider keys to the ASPSP names Enable Banking lists for GB.
# Verify exact names against GET /aspsps?country=GB and tweak if needed.
OPEN_BANKING = {
    "lloyds": {"match": "Lloyds", "name": "Lloyds"},
    "chase": {"match": "Chase", "name": "Chase"},
}

app = FastAPI(title="Tend Phase-B backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[APP_URL, "http://localhost:4178"],
    allow_methods=["*"], allow_headers=["*"], allow_credentials=False,
)


def eb() -> EnableBanking:
    return EnableBanking(os.environ.get("ENABLE_APPLICATION_ID", ""), os.environ.get("ENABLE_PRIVATE_KEY", ""))


async def current_user(authorization: Optional[str]) -> str:
    token = (authorization or "").removeprefix("Bearer ").strip()
    try:
        return await store.verify_user(token)
    except store.AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


def _norm_account_uid(a):
    return a if isinstance(a, str) else (a.get("uid") or a.get("account_uid") or a.get("id"))


@app.get("/")
def health():
    return {"ok": True, "service": "tend-phase-b", "app": APP_URL,
            "providers": list(OPEN_BANKING.keys()) + ["t212"]}


# ── Connections overview ──────────────────────────────────────────────────────
@app.get("/connections")
async def connections(authorization: Optional[str] = Header(default=None)):
    user_id = await current_user(authorization)
    out = []
    for c in await store.get_connections(user_id):
        p = c.get("provider")
        out.append({
            "provider": p,
            "display_name": c.get("display_name") or p,
            "connected": bool(c.get("session_id") or c.get("api_key")),
            "accounts": len(c.get("accounts") or []) if c.get("accounts") else None,
        })
    return {"connections": out}


# ── Open Banking: Lloyds / Chase ──────────────────────────────────────────────
@app.post("/bank/auth")
async def bank_auth(bank: str = "lloyds", authorization: Optional[str] = Header(default=None)):
    """Start the consent flow for a bank. Returns { url } for the browser."""
    user_id = await current_user(authorization)
    cfg = OPEN_BANKING.get(bank)
    if not cfg:
        raise HTTPException(status_code=400, detail=f"Unknown bank '{bank}'")
    state = uuid.uuid4().hex
    valid_until = (dt.datetime.utcnow() + dt.timedelta(days=VALID_DAYS)).replace(microsecond=0).isoformat() + "Z"
    try:
        client = eb()
        aspsp = await client.find_aspsp(cfg["match"], "GB")
        res = await client.start_auth(aspsp, f"{BACKEND_URL}/bank/callback", state, valid_until)
    except EnableBankingError as e:
        raise HTTPException(status_code=502, detail=str(e))
    await store.upsert_connection(user_id, bank, {
        "display_name": cfg["name"], "state": state,
        "authorization_id": res.get("authorization_id"), "aspsp": aspsp,
        "session_id": None, "accounts": None,
    })
    return {"url": res.get("url")}


@app.get("/bank/callback")
async def bank_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Enable Banking redirects here after the user consents at their bank."""
    if error or not code or not state:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    conn = await store.get_connection_by_state(state)
    if not conn:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    try:
        session = await eb().create_session(code)
    except EnableBankingError:
        return RedirectResponse(f"{APP_URL}/?bank=error")
    await store.upsert_connection(conn["user_id"], conn["provider"], {
        "session_id": session.get("session_id"),
        "accounts": session.get("accounts"),
        "aspsp": session.get("aspsp", conn.get("aspsp")),
        "state": None,
    })
    return RedirectResponse(f"{APP_URL}/?bank=connected&provider={conn['provider']}")


@app.get("/bank/transactions")
async def bank_transactions(days: int = 90, authorization: Optional[str] = Header(default=None)):
    """Normalised transactions across ALL connected banks, ready for state.transactions."""
    user_id = await current_user(authorization)
    date_from = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    out = []
    client = eb()
    for conn in await store.get_connections(user_id):
        if conn.get("provider") not in OPEN_BANKING or not conn.get("session_id"):
            continue
        bank_name = conn.get("display_name") or conn.get("provider")
        for a in (conn.get("accounts") or []):
            uid = _norm_account_uid(a)
            if not uid:
                continue
            try:
                data = await client.transactions(uid, date_from)
            except EnableBankingError:
                continue
            for t in data.get("transactions", []):
                amt = t.get("transaction_amount", {}) or t.get("amount", {})
                value = float(amt.get("amount", 0) or 0)
                credit = (t.get("credit_debit_indicator") or "").upper() == "CRDT"
                out.append({
                    "date": (t.get("booking_date") or t.get("value_date") or date_from)[:10],
                    "amount": abs(value),
                    "type": "income" if credit else "spend",
                    "description": (t.get("creditor", {}) or {}).get("name")
                    or (t.get("debtor", {}) or {}).get("name")
                    or " ".join(t.get("remittance_information", []) or []) or "Transaction",
                    "source": "bank", "bank": bank_name,
                })
    return {"transactions": out}


@app.post("/bank/disconnect")
async def bank_disconnect(bank: str, authorization: Optional[str] = Header(default=None)):
    user_id = await current_user(authorization)
    await store.delete_connection(user_id, bank)
    return {"ok": True}


# ── Trading 212 ───────────────────────────────────────────────────────────────
@app.post("/t212/connect")
async def t212_connect(body: dict, authorization: Optional[str] = Header(default=None)):
    user_id = await current_user(authorization)
    api_key = (body or {}).get("api_key", "").strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Missing api_key")
    try:
        await Trading212(api_key, T212_MODE).account_info()  # validate
    except Trading212Error as e:
        raise HTTPException(status_code=400, detail=str(e))
    await store.upsert_connection(user_id, "t212", {"display_name": "Trading 212", "api_key": api_key})
    return {"ok": True}


@app.get("/t212/portfolio")
async def t212_portfolio(authorization: Optional[str] = Header(default=None)):
    user_id = await current_user(authorization)
    conn = await store.get_connection(user_id, "t212")
    if not conn or not conn.get("api_key"):
        raise HTTPException(status_code=404, detail="Trading 212 not connected")
    try:
        return await Trading212(conn["api_key"], T212_MODE).snapshot()
    except Trading212Error as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/t212/disconnect")
async def t212_disconnect(authorization: Optional[str] = Header(default=None)):
    user_id = await current_user(authorization)
    await store.delete_connection(user_id, "t212")
    return {"ok": True}
