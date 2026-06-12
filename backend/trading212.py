"""
Trading 212 API client (https://t212public.docs.apiary.io / official Invest API).

Read-only. The user creates an API key in the Trading 212 app
(Settings → API (Beta)) with **read** scopes and pastes it into Tend. The key
is stored server-side only (in the `connections` table) and used here.

IMPORTANT
- The browser CANNOT call Trading 212 directly (CORS + key exposure), so this
  proxy is required.
- Trading 212 rate limits are strict (often ~1 request / few seconds per
  endpoint). Cache results and avoid tight polling.
- Base URLs:
    live: https://live.trading212.com/api/v0
    demo: https://demo.trading212.com/api/v0
  Pick per the key type the user generated.

Auth: header `Authorization: <api_key>` (the raw key — NOT "Bearer ...").
"""
import os
import httpx

LIVE_BASE = "https://live.trading212.com/api/v0"
DEMO_BASE = "https://demo.trading212.com/api/v0"


class Trading212Error(Exception):
    pass


class Trading212:
    def __init__(self, api_key: str, mode: str = "live"):
        if not api_key:
            raise Trading212Error("Missing Trading 212 API key")
        self.api_key = api_key
        self.base = DEMO_BASE if mode == "demo" else (os.environ.get("T212_API_BASE") or LIVE_BASE)

    def _headers(self) -> dict:
        return {"Authorization": self.api_key}

    async def _get(self, path: str):
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base}{path}", headers=self._headers())
        if r.status_code == 401:
            raise Trading212Error("Invalid Trading 212 API key")
        if r.status_code == 429:
            raise Trading212Error("Trading 212 rate limit — try again shortly")
        if r.status_code >= 400:
            raise Trading212Error(f"T212 {path} -> {r.status_code}: {r.text}")
        return r.json() if r.content else {}

    async def account_info(self):
        # Cheap call used to validate a key on connect.
        return await self._get("/equity/account/info")

    async def cash(self):
        return await self._get("/equity/account/cash")

    async def portfolio(self):
        # Open positions: [{ ticker, quantity, averagePrice, currentPrice, ppl, ... }]
        return await self._get("/equity/portfolio")

    async def snapshot(self) -> dict:
        """Normalised portfolio for the front-end Investments tab."""
        cash = await self.cash()
        positions = await self.portfolio()
        holdings = []
        for p in (positions or []):
            qty = float(p.get("quantity", 0) or 0)
            price = float(p.get("currentPrice", 0) or 0)
            avg = float(p.get("averagePrice", 0) or 0)
            holdings.append({
                "ticker": p.get("ticker", ""),
                "units": qty,
                "price": price,
                "avgCost": avg,
                "value": round(qty * price, 2),
                "ppl": round(float(p.get("ppl", 0) or 0), 2),  # profit/loss
                "source": "t212",
            })
        return {
            "cash": round(float((cash or {}).get("free", 0) or 0), 2),
            "invested": round(float((cash or {}).get("invested", 0) or 0), 2),
            "result": round(float((cash or {}).get("result", 0) or 0), 2),
            "total": round(float((cash or {}).get("total", 0) or 0), 2),
            "holdings": holdings,
        }
