from fastapi import FastAPI, APIRouter, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


# ── Dhan direct API ──
# Workaround: user's Supabase /test-api-connection and /fund-limits return
# "Invalid token" even when the token is valid (verified by direct Dhan call).
# This endpoint hits Dhan's official API directly to give a real connection test.
@api_router.post("/dhan/test-direct")
async def dhan_test_direct(payload: dict):
    """Test Dhan credentials directly against Dhan's official API.
    Body: { clientId, accessToken }
    Returns funds + connection status."""
    client_id = (payload or {}).get('clientId') or (payload or {}).get('dhanClientId')
    access_token = (payload or {}).get('accessToken') or (payload or {}).get('dhanAccessToken')
    if not client_id or not access_token:
        return {"success": False, "connected": False, "error": "Missing clientId or accessToken"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.get(
                'https://api.dhan.co/v2/fundlimit',
                headers={
                    'access-token': access_token,
                    'client-id': str(client_id),
                    'Content-Type': 'application/json',
                },
            )
        if r.status_code == 200:
            d = r.json()
            return {
                "success": True,
                "connected": True,
                "message": "✓ Dhan API connected (verified directly)",
                "funds": {
                    "availableBalance": d.get('availabelBalance', d.get('availableBalance', 0)),
                    "sodLimit": d.get('sodLimit', 0),
                    "utilizationAmount": d.get('utilizedAmount', 0),
                    "utilizedAmount": d.get('utilizedAmount', 0),
                    "collateralAmount": d.get('collateralAmount', 0),
                    "withdrawableBalance": d.get('withdrawableBalance', 0),
                    "blockedPayoutAmount": d.get('blockedPayoutAmount', 0),
                    "receiveableAmount": d.get('receiveableAmount', 0),
                },
                "raw": d,
            }
        elif r.status_code == 401:
            return {
                "success": False, "connected": False,
                "error": "Invalid or expired access token",
                "detail": "Dhan rejected this token. Please regenerate from web.dhan.co",
                "status": r.status_code,
            }
        else:
            return {
                "success": False, "connected": False,
                "error": f"Dhan API returned HTTP {r.status_code}",
                "detail": r.text[:300],
                "status": r.status_code,
            }
    except httpx.TimeoutException:
        return {"success": False, "connected": False, "error": "Connection timeout — Dhan API unreachable"}
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e)}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**s) for s in status_checks]


# ─── PROXY ENDPOINTS ──────────────────────────────────────
# Forward calls to the user's Supabase stack, bypassing browser CORS.
EDGE_BASE = "https://api.indexpilotai.com/functions/v1/make-server-c4d79cb7"
SUPABASE_BASE = "https://oklgqelcaujxntgjyuis.supabase.co"
DHAN_CSV_URL = "https://images.dhan.co/api-data/api-scrip-master-detailed.csv"
ALLOWED_HEADERS = {"authorization", "apikey", "content-type"}


async def _proxy(target_url: str, request: Request) -> Response:
    headers = {k: v for k, v in request.headers.items() if k.lower() in ALLOWED_HEADERS}
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=30.0) as hc:
            r = await hc.request(request.method, target_url, headers=headers, content=body)
        return Response(
            content=r.content,
            status_code=r.status_code,
            media_type=r.headers.get("content-type", "application/json"),
        )
    except httpx.RequestError as e:
        return Response(
            content=f'{{"error":"proxy_failed","detail":"{str(e)}"}}',
            status_code=502,
            media_type="application/json",
        )


@api_router.api_route("/edge/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_edge(path: str, request: Request):
    qs = request.url.query
    url = f"{EDGE_BASE}/{path}" + (f"?{qs}" if qs else "")
    return await _proxy(url, request)


@api_router.api_route("/sb/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_sb(path: str, request: Request):
    qs = request.url.query
    url = f"{SUPABASE_BASE}/{path}" + (f"?{qs}" if qs else "")
    return await _proxy(url, request)


# In-memory cache for Dhan instrument CSV (~20MB) with NIFTY/BANKNIFTY/SENSEX
# options pre-filtered. Refreshed on demand.
_DHAN_CACHE: dict = {"data": None, "ts": 0.0}


@api_router.get("/instruments/dhan-options")
async def dhan_options(force: bool = False):
    """Download + filter Dhan CSV server-side. Returns NIFTY/BANKNIFTY/SENSEX options.

    Dhan CSV (api-scrip-master-detailed.csv) columns (June 2025):
      EXCH_ID, SEGMENT, SECURITY_ID, ISIN, INSTRUMENT, UNDERLYING_SECURITY_ID,
      UNDERLYING_SYMBOL, SYMBOL_NAME, DISPLAY_NAME, INSTRUMENT_TYPE, SERIES,
      LOT_SIZE, SM_EXPIRY_DATE, STRIKE_PRICE, OPTION_TYPE, ...
    """
    import time as _t
    now = _t.time()
    if not force and _DHAN_CACHE["data"] and (now - _DHAN_CACHE["ts"] < 86400):
        return _DHAN_CACHE["data"]
    try:
        async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as hc:
            r = await hc.get(DHAN_CSV_URL)
        if r.status_code != 200:
            return {"error": "csv_download_failed", "status": r.status_code}
        text = r.text
        lines = text.splitlines()
        if not lines:
            return {"error": "empty_csv"}
        header = [h.strip() for h in lines[0].split(",")]

        def col(*names: str) -> int:
            for n in names:
                if n in header:
                    return header.index(n)
            return -1

        c_exch = col("EXCH_ID", "SEM_EXM_EXCH_ID")
        c_inst = col("INSTRUMENT", "SEM_INSTRUMENT_NAME")
        c_sym = col("SYMBOL_NAME", "SEM_TRADING_SYMBOL")
        c_disp = col("DISPLAY_NAME", "SEM_CUSTOM_SYMBOL")
        c_under = col("UNDERLYING_SYMBOL", "SEM_CUSTOM_SYMBOL")
        c_strike = col("STRIKE_PRICE", "SEM_STRIKE_PRICE")
        c_opt = col("OPTION_TYPE", "SEM_OPTION_TYPE")
        c_expiry = col("SM_EXPIRY_DATE", "SEM_EXPIRY_DATE")
        c_secid = col("SECURITY_ID", "SEM_SMST_SECURITY_ID")
        c_lot = col("LOT_SIZE", "SEM_LOT_UNITS")

        out = {"NIFTY": [], "BANKNIFTY": [], "SENSEX": []}
        today_ts = _t.time()
        for ln in lines[1:]:
            parts = ln.split(",")
            if len(parts) < len(header) - 1:
                continue
            try:
                inst = parts[c_inst].strip() if c_inst >= 0 else ""
                if inst != "OPTIDX":
                    continue  # Index options only (OPTIDX) — skip stock options
                under = parts[c_under].strip().upper() if c_under >= 0 else ""
                if under not in ("NIFTY", "BANKNIFTY", "SENSEX"):
                    continue
                opt_type = parts[c_opt].strip().upper() if c_opt >= 0 else ""
                if opt_type not in ("CE", "PE"):
                    continue
                expiry = parts[c_expiry].strip() if c_expiry >= 0 else ""
                # Skip expired
                if expiry:
                    try:
                        from datetime import datetime as _dt
                        ex_ts = _dt.strptime(expiry, "%Y-%m-%d").timestamp()
                        if ex_ts < today_ts - 86400:
                            continue
                    except Exception:
                        pass
                strike_raw = parts[c_strike].strip() if c_strike >= 0 else ""
                try:
                    strike_v = float(strike_raw or 0)
                except Exception:
                    continue
                if strike_v <= 0:
                    continue
                secid = parts[c_secid].strip() if c_secid >= 0 else ""
                if not secid:
                    continue
                sym = parts[c_sym].strip() if c_sym >= 0 else ""
                disp = parts[c_disp].strip() if c_disp >= 0 else ""
                lot = parts[c_lot].strip() if c_lot >= 0 else "1"
                exch_id = parts[c_exch].strip().upper() if c_exch >= 0 else ""
                exch = "NSE_FNO" if exch_id == "NSE" else ("BSE_FNO" if exch_id == "BSE" else (exch_id or "NSE_FNO"))
                out[under].append({
                    "tradingSymbol": sym,
                    "displaySymbol": disp or sym,
                    "securityId": secid,
                    "strike": strike_v,
                    "expiry": expiry,
                    "optionType": opt_type,
                    "lot": int(float(lot or 1)),
                    "exchange": exch,
                    "index": under,
                })
            except Exception:
                continue

        # Sort each by expiry then strike
        for k in out:
            out[k].sort(key=lambda x: (x["expiry"], x["strike"]))

        result = {
            "success": True,
            "total": sum(len(v) for v in out.values()),
            "counts": {k: len(v) for k, v in out.items()},
            "instruments": out,
            "fetchedAt": int(now * 1000),
        }
        _DHAN_CACHE["data"] = result
        _DHAN_CACHE["ts"] = now
        return result
    except Exception as e:
        return {"error": "exception", "detail": str(e)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
