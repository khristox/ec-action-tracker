# app/main.py
"""
Action Tracker - Main Application Entry Point
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import logging
import time
import os
from pathlib import Path
from typing import Dict, Any, Optional
import traceback

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import async_engine
from app.api.v1.api import api_router
from app.middleware.audit_middleware import AuditMiddleware

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# ==================== APPLICATION STATE ====================

class AppState:
    start_time: float = 0
    database_connected: bool = False
    request_count: int = 0
    error_count: int = 0
    last_error: Optional[str] = None

app_state = AppState()

# ==================== FRONTEND PATH ====================

def get_frontend_path() -> Optional[Path]:
    candidates = [
        Path(__file__).parent.parent.parent / "frontend" / "rms" / "dist",
        Path.cwd() / "frontend" / "rms" / "dist",
        Path("/home/chris/Chr/Apps/ECATMIS/frontend/dist"),
    ]
    frontend_path_env = os.getenv("FRONTEND_DIST_PATH")
    if frontend_path_env:
        candidates.insert(0, Path(frontend_path_env))
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            logger.info(f"✅ Found frontend build at: {candidate}")
            return candidate
    logger.warning("⚠️ Frontend build not found")
    return None

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 70)
    logger.info("🚀 Action Tracker STARTUP")
    logger.info("=" * 70)

    app_state.start_time = time.time()

    logger.info(f"📌 Project: {settings.PROJECT_NAME}")
    logger.info(f"📌 Version: {settings.VERSION}")
    logger.info(f"📌 Environment: {settings.ENVIRONMENT}")
    logger.info(f"📌 Debug Mode: {settings.DEBUG}")
    logger.info(f"📌 API Prefix: {settings.API_V1_STR}")

    frontend_dist = get_frontend_path()
    if frontend_dist and frontend_dist.exists():
        logger.info(f"🎨 Frontend Build Found: {frontend_dist}")
    else:
        logger.info("📦 Frontend not built - API only mode")

    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            try:
                version_result = await conn.execute(text("SELECT VERSION()"))
                version = version_result.scalar()
                logger.info(f"📊 Database Version: {version[:100] if version else 'Unknown'}")
            except:
                pass
        app_state.database_connected = True
        logger.info("✅ Database Connection: SUCCESSFUL")
    except Exception as e:
        app_state.database_connected = False
        logger.error(f"❌ Database Connection: FAILED - {e}")

    cors_origins = settings.CORS_ORIGINS
    if cors_origins:
        logger.info(f"🔒 CORS Allowed Origins: {len(cors_origins)} configured")
        if settings.DEBUG:
            logger.debug(f"   Origins: {cors_origins}")
    else:
        logger.warning("⚠️ No CORS origins configured")

    logger.info("=" * 70)
    logger.info("✨ Application Ready")
    logger.info(f"🌐 API Documentation: http://localhost:8001/docs")
    logger.info(f"🔍 Health Check: http://localhost:8001/health")
    logger.info("=" * 70)

    yield

    logger.info("=" * 70)
    logger.info("🛑 APPLICATION SHUTDOWN")
    logger.info("=" * 70)

    if async_engine:
        try:
            await async_engine.dispose()
            logger.info("✅ Database connections closed")
        except Exception as e:
            logger.error(f"❌ Error closing database connections: {e}")

    uptime = time.time() - app_state.start_time
    logger.info(f"⏱️ Uptime: {uptime:.2f} seconds")
    logger.info(f"📊 Total Requests: {app_state.request_count}")
    logger.info(f"❌ Total Errors: {app_state.error_count}")
    logger.info("=" * 70)

# ==================== FASTAPI APP ====================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Action Tracker for Electoral Commission - Meeting and Task Management",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ==================== MIDDLEWARE ====================

@app.middleware("http")
async def count_requests(request: Request, call_next):
    start_time = time.time()
    app_state.request_count += 1
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    if process_time > 1.0:
        logger.warning(f"Slow request: {request.method} {request.url.path} - {process_time:.2f}s")
    return response

app.add_middleware(AuditMiddleware)

cors_origins = settings.CORS_ORIGINS
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Process-Time", "X-Request-ID"],
        max_age=600,
    )
    logger.info(f"✅ CORS configured with {len(cors_origins)} origins")
    if cors_origins == ["*"] and settings.ENVIRONMENT == "production":
        logger.warning("⚠️ CORS allows all origins in production - not recommended!")
else:
    logger.warning("⚠️ CORS not configured")

# ==================== EXCEPTION HANDLERS ====================
# (keep your existing handlers here unchanged)

# ==================== PUBLIC ENDPOINTS ====================
# (keep your health/info/debug endpoints here unchanged)

# ==================== FRONTEND SERVING ====================
# (keep your frontend serving logic here unchanged)

# ==================== API ROUTES ====================
app.include_router(api_router, prefix=settings.API_V1_STR)

logger.info("=" * 70)
logger.info(f"✅ Registered {len(app.routes)} total routes")
logger.info(f"✅ API routes registered under {settings.API_V1_STR}")
logger.info("=" * 70)

# ==================== STARTUP ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
        log_level="info"
    )
