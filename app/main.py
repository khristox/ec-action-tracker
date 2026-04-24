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
from datetime import datetime
import platform
import sys

# 1. LOAD ENVIRONMENT VARIABLES FIRST
load_dotenv()

from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import async_engine
from app.api.v1.api import api_router
from sqlalchemy import text

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
    print(f"Checking fallback frontend path: {fallback}" )
    if fallback.exists() and fallback.is_dir():
        return fallback
    return None

# ==================== HEALTH CHECK FUNCTIONS ====================

async def check_database_health() -> dict:
    """Check database connectivity and health"""
    try:
        async with async_engine.connect() as conn:
            # Execute a simple query to check database
            result = await conn.execute(text("SELECT 1"))
            await conn.execute(text("SELECT 1"))
            
            # Get database version
            db_type = str(async_engine.url.drivername)
            version_result = await conn.execute(text("SELECT VERSION()"))
            version = version_result.scalar()
            
            return {
                "status": "healthy",
                "type": db_type,
                "version": str(version) if version else "unknown",
                "connected": True
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }

async def check_system_health() -> dict:
    """Check system health (CPU, memory, disk)"""
    import psutil
    
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.5)
        
        # Memory usage
        memory = psutil.virtual_memory()
        
        # Disk usage for current directory
        disk = psutil.disk_usage('/')
        
        return {
            "status": "healthy" if cpu_percent < 90 and memory.percent < 90 else "degraded",
            "cpu": {
                "usage_percent": cpu_percent,
                "cores": psutil.cpu_count()
            },
            "memory": {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "used_gb": round(memory.used / (1024**3), 2),
                "usage_percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "used_gb": round(disk.used / (1024**3), 2),
                "usage_percent": disk.percent
            }
        }
    except Exception as e:
        logger.warning(f"System health check failed: {e}")
        return {
            "status": "unknown",
            "error": str(e)
        }

async def check_app_health() -> dict:
    """Check application health"""
    return {
        "status": "healthy",
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "root_path": ROOT_PATH or "/",
        "api_prefix": settings.API_V1_STR
    }

# ==================== APP INITIALIZATION ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Action Tracker STARTUP")
    logger.info(f"🔗 ROOT_PATH: '{ROOT_PATH}' (empty = local dev)")
    logger.info(f"🌍 Environment: {settings.ENVIRONMENT}")
    logger.info(f"🐍 Python version: {platform.python_version()}")
    
    # Test database connection on startup
    db_health = await check_database_health()
    if db_health["connected"]:
        logger.info(f"✅ Database connected: {db_health['type']} {db_health['version']}")
    else:
        logger.error(f"❌ Database connection failed: {db_health.get('error', 'Unknown error')}")
    
    yield
    
    if async_engine:
        await async_engine.dispose()
        logger.info("🛑 Database connections closed")

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

# ==================== HEALTH CHECK ENDPOINTS ====================

@app.get("/health", tags=["Health"])
async def health_check():
    """
    Basic health check endpoint for load balancers and monitoring.
    Returns 200 if the application is running.
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    """
    Detailed health check with database, system, and application status.
    Useful for deep monitoring and debugging.
    """
    # Check all components in parallel
    import asyncio
    db_health, system_health, app_health = await asyncio.gather(
        check_database_health(),
        check_system_health(),
        check_app_health()
    )
    
    overall_status = "healthy"
    if db_health["status"] != "healthy" or system_health["status"] not in ["healthy", "degraded"]:
        overall_status = "unhealthy"
    elif system_health["status"] == "degraded":
        overall_status = "degraded"
    
    response = {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": None,  # Could track startup time
        "components": {
            "database": db_health,
            "system": system_health,
            "application": app_health
        }
    }
    
    # Return 503 if unhealthy
    if overall_status == "unhealthy":
        raise HTTPException(status_code=503, detail=response)
    
    return response

@app.get("/health/ready", tags=["Health"])
async def readiness_check():
    """
    Readiness probe for Kubernetes/Docker.
    Checks if the application is ready to accept traffic.
    """
    # Check database connectivity
    db_health = await check_database_health()
    
    if not db_health["connected"]:
        raise HTTPException(status_code=503, detail="Database not ready")
    
    return {
        "status": "ready",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/live", tags=["Health"])
async def liveness_check():
    """
    Liveness probe for Kubernetes/Docker.
    Checks if the application is still running.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/health/metrics", tags=["Health"])
async def metrics():
    """
    Prometheus-style metrics endpoint.
    Returns system metrics for monitoring.
    """
    import psutil
    
    metrics = {
        "timestamp": datetime.utcnow().isoformat(),
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation()
        },
        "cpu": {
            "usage_percent": psutil.cpu_percent(interval=0.5),
            "cores_logical": psutil.cpu_count(),
            "cores_physical": psutil.cpu_count(logical=False),
            "frequency_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None
        },
        "memory": {
            "total_bytes": psutil.virtual_memory().total,
            "available_bytes": psutil.virtual_memory().available,
            "used_bytes": psutil.virtual_memory().used,
            "percent": psutil.virtual_memory().percent
        },
        "disk": {
            "total_bytes": psutil.disk_usage('/').total,
            "used_bytes": psutil.disk_usage('/').used,
            "free_bytes": psutil.disk_usage('/').free,
            "percent": psutil.disk_usage('/').percent
        }
    }
    
    return metrics

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
        # Use a relative path './' so it works with any ROOT_PATH
        openapi_url="./openapi.json",
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
        openapi_url="./openapi.json",
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
            # 1. Clean the path to handle potential leading slashes from some proxies
            check_path = path.lstrip("/")

            # 2. Updated exclusion list to be more flexible
            excluded_prefixes = ("api/", "docs", "redoc", "openapi.json", "health")
            
            if any(check_path.startswith(prefix) for prefix in excluded_prefixes):
                raise HTTPException(status_code=404)

            file_path = frontend_dist / path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)

            # Fallback to index.html for SPA routing
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