"""
Action Tracker - Main Application Entry Point
"""
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv # Ensure you have python-dotenv installed

# 1. LOAD ENVIRONMENT VARIABLES FIRST
# This makes os.getenv("FRONTEND_DIST_PATH") work
load_dotenv()

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import async_engine
from app.api.v1.api import api_router

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# ==================== FRONTEND PATH LOGIC ====================

def get_frontend_path() -> Optional[Path]:
    """
    Get the path to the frontend dist directory.
    """
    # Try the env var specifically
    env_path = os.getenv("FRONTEND_DIST_PATH")
    if env_path:
        path = Path(env_path)
        if path.exists() and path.is_dir():
            return path
            
    # Fallback to hardcoded static if env var fails
    fallback = Path("/home/chris/Chr/Apps/ECATMIS/static")
    if fallback.exists() and fallback.is_dir():
        return fallback
        
    return None

# ==================== APP INITIALIZATION ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Action Tracker STARTUP")
    yield
    if async_engine:
        await async_engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# CORS
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# API Routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# ==================== FRONTEND SERVING ====================

# settings.DEBUG is now correctly False because load_dotenv() was called
if not settings.DEBUG:
    frontend_dist = get_frontend_path()
    
    if frontend_dist:
        logger.info(f"🎨 Serving frontend from: {frontend_dist}")
        
        # Mount the assets subfolder (Standard for Vite/React/Vue)
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
        @app.get("/")
        async def serve_index():
            return FileResponse(frontend_dist / "index.html")

        @app.get("/{path:path}")
        async def serve_spa(path: str):
            # Ignore API/Docs
            if path.startswith(("api/", "docs", "redoc", "openapi.json")):
                raise HTTPException(status_code=404)
            
            # If file exists (like favicon.ico), serve it
            file_path = frontend_dist / path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            
            # Otherwise, serve index.html for SPA routing
            return FileResponse(frontend_dist / "index.html")
    else:
        # This is where your error was triggering
        logger.error(f"❌ FRONTEND_DIST_PATH is: {os.getenv('FRONTEND_DIST_PATH')}")
        logger.error("❌ Frontend directory not found! Check if /static exists.")
else:
    logger.info("🔧 DEBUG=True: Frontend serving via FastAPI is disabled.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=settings.DEBUG)