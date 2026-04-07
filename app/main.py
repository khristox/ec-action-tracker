"""
Action Tracker - Main Application Entry Point
Optimized for sub-path hosting (/actiontracker)
"""
import logging
import time
import os
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

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

app_state = AppState()

# ==================== PATH CONFIGURATION ====================

# We use "static" as the folder name where your React 'dist' files live
STATIC_DIR = Path.cwd() / "static"
ASSETS_DIR = STATIC_DIR / "assets"

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting Action Tracker on Port 8001")
    app_state.start_time = time.time()

    # Database Heartbeat
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        app_state.database_connected = True
        logger.info("✅ Database Connection: SUCCESSFUL")
    except Exception as e:
        app_state.database_connected = False
        logger.error(f"❌ Database Connection: FAILED - {e}")

    yield
    await async_engine.dispose()

# ==================== FASTAPI APP ====================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    # Move docs to prevent conflict with frontend paths
    docs_url="/actiontracker/api/docs",
    openapi_url="/actiontracker/api/openapi.json",
)

# ==================== MIDDLEWARE ====================

app.add_middleware(AuditMiddleware)

if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ==================== API ROUTES ====================

# Include backend API first
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy" if app_state.database_connected else "degraded"}

# ==================== RELATIVE FRONTEND SERVING ====================

if STATIC_DIR.exists() and STATIC_DIR.is_dir():
    # 1. Mount Assets specifically for the sub-path
    # Browser will look for: /actiontracker/assets/index-xxx.js
    if ASSETS_DIR.exists():
        app.mount(
            "/actiontracker/assets", 
            StaticFiles(directory=str(ASSETS_DIR)), 
            name="static_assets"
        )

    # 2. Serve other static files (favicon, manifest, etc)
    @app.get("/actiontracker/{file_name:path}", include_in_schema=False)
    async def serve_static_files(file_name: str):
        # Prevent API calls from hitting this
        if file_name.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
            
        file_path = STATIC_DIR / file_name
        if file_path.is_file():
            return FileResponse(str(file_path))
            
        # 3. SPA Catch-all: Return index.html for any React Route
        return FileResponse(str(STATIC_DIR / "index.html"))

    # 4. Handle the base sub-path redirect
    @app.get("/actiontracker", include_in_schema=False)
    async def redirect_to_actiontracker():
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/actiontracker/")
else:
    logger.warning(f"⚠️ Static directory NOT found at {STATIC_DIR}. API-only mode.")

# ==================== EXECUTION ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=False)