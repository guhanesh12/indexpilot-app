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
