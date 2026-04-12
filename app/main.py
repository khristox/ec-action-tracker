"""
Action Tracker - Main Application Entry Point
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# 1. LOAD ENVIRONMENT VARIABLES FIRST
load_dotenv()

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import async_engine
from app.api.v1.api import api_router

setup_logging()
logger = logging.getLogger(__name__)

# ROOT_PATH — controls all URL prefixes (e.g. /ec in production, empty locally)
ROOT_PATH = os.getenv("ROOT_PATH", "")

# ==================== FRONTEND PATH LOGIC ====================

def get_frontend_path() -> Optional[Path]:
    env_path = os.getenv("FRONTEND_DIST_PATH")
    if env_path:
        path = Path(env_path)
        if path.exists() and path.is_dir():
            return path
    fallback = Path("/home/chris/Chr/Apps/ECATMIS/static")
    if fallback.exists() and fallback.is_dir():
        return fallback
    return None

# ==================== APP INITIALIZATION ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Action Tracker STARTUP")
    logger.info(f"🔗 ROOT_PATH: '{ROOT_PATH}' (empty = local dev)")
    yield
    if async_engine:
        await async_engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url=None,    # served manually below
    redoc_url=None,
    openapi_url=None,
)

# ==================== CORS ====================
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ==================== API ROUTES ====================
app.include_router(api_router, prefix=settings.API_V1_STR)

# ==================== CUSTOM OPENAPI / SWAGGER ====================

@app.get("/openapi.json", include_in_schema=False)
async def custom_openapi():
    if app.openapi_schema:
        return JSONResponse(app.openapi_schema)
    
    openapi_schema = get_openapi(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        routes=app.routes,
        servers=[{
            "url": ROOT_PATH or "/",
            "description": "Production" if ROOT_PATH else "Local dev",
        }],
    )

    # ── Patch tokenUrl in securitySchemes so Swagger Authorize uses correct path ──
    try:
        schemes = openapi_schema.get("components", {}).get("securitySchemes", {})
        for scheme in schemes.values():
            if scheme.get("type") == "oauth2":
                flows = scheme.get("flows", {})
                for flow in flows.values():
                    if "tokenUrl" in flow:
                        token_url = flow["tokenUrl"]
                        # Only prepend ROOT_PATH if not already absolute
                        if ROOT_PATH and not token_url.startswith(("http", ROOT_PATH)):
                            flow["tokenUrl"] = f"{ROOT_PATH}{token_url}"
                            logger.info(f"Patched tokenUrl → {flow['tokenUrl']}")
    except Exception as e:
        logger.warning(f"Could not patch tokenUrl: {e}")

    app.openapi_schema = openapi_schema
    return JSONResponse(openapi_schema)


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    return get_swagger_ui_html(
        openapi_url=f"{ROOT_PATH}/openapi.json",
        title=settings.PROJECT_NAME + " - Swagger UI",
        swagger_ui_parameters={
            "persistAuthorization": True,
            "displayRequestDuration": True,
            "filter": True,
        },
    )


@app.get("/redoc", include_in_schema=False)
async def custom_redoc():
    return get_redoc_html(
        openapi_url=f"{ROOT_PATH}/openapi.json",
        title=settings.PROJECT_NAME + " - ReDoc",
    )

# ==================== FRONTEND SERVING ====================

if not settings.DEBUG:
    frontend_dist = get_frontend_path()

    if frontend_dist:
        logger.info(f"🎨 Serving frontend from: {frontend_dist}")

        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/")
        async def serve_index():
            return FileResponse(frontend_dist / "index.html")

        @app.get("/{path:path}")
        async def serve_spa(path: str):
            # Never intercept FastAPI's own routes
            if path.startswith(("api/", "docs", "redoc", "openapi.json")):
                raise HTTPException(status_code=404)

            file_path = frontend_dist / path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)

            return FileResponse(frontend_dist / "index.html")

    else:
        logger.error(f"❌ FRONTEND_DIST_PATH: {os.getenv('FRONTEND_DIST_PATH')}")
        logger.error("❌ Frontend directory not found!")
else:
    logger.info("🔧 DEBUG=True: Frontend serving disabled.")

# ==================== ENTRY POINT ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.DEBUG,
    )