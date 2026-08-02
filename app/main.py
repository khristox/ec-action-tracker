"""
Action Tracker - Main Application Entry Point

Handles:
- FastAPI application setup
- Async lifespan management (startup/shutdown)
- Health checks and monitoring
- CORS configuration
- Rate limiting
- Frontend serving
- API routing
- Reminder scheduler integration
"""
import logging
import os
import platform
import sys
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sqlalchemy import text

# ==================== LOAD ENVIRONMENT VARIABLES FIRST ====================
load_dotenv()

# ==================== IMPORT CONFIGURATION ====================
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.base import async_engine
from app.api.v1.api import api_router
from app.core.redis_client import init_redis, close_redis, get_redis
from app.core.limiter import limiter
from app.core.minio_client import minio_service
from app.services.reminder_scheduler import reminder_scheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# ==================== SETUP LOGGING ====================
setup_logging()
logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================
ROOT_PATH = os.getenv("ROOT_PATH", "")


# ==================== FRONTEND PATH LOGIC ====================

def get_frontend_path() -> Optional[Path]:
    """
    Get the frontend distribution path.
    
    Tries:
    1. FRONTEND_DIST_PATH environment variable
    2. Fallback to /home/chris/Chr/Apps/ECATMIS/static
    3. Returns None if not found
    """
    # Try environment variable first
    env_path = os.getenv("FRONTEND_DIST_PATH")
    if env_path:
        path = Path(env_path)
        if path.exists() and path.is_dir():
            logger.info(f"✅ Frontend found at (env): {path}")
            return path
    
    # Try fallback path
    fallback = Path("/home/chris/Chr/Apps/ECATMIS/static")
    logger.info(f"Checking fallback frontend path: {fallback}")
    if fallback.exists() and fallback.is_dir():
        logger.info(f"✅ Frontend found at (fallback): {fallback}")
        return fallback
    
    return None


# ==================== HEALTH CHECK FUNCTIONS ====================

async def check_database_health() -> dict:
    """
    Check database connectivity and health.
    
    Returns dict with:
    - status: "healthy" or "unhealthy"
    - type: database type (postgresql, mysql, etc.)
    - version: database version
    - connected: boolean
    """
    try:
        async with async_engine.connect() as conn:
            # Execute a simple query to check database
            await conn.execute(text("SELECT 1"))
            
            # Get database type
            db_type = str(async_engine.url.drivername)
            
            # Get database version
            version_result = await conn.execute(text("SELECT VERSION()"))
            version = version_result.scalar()
            
            return {
                "status": "healthy",
                "type": db_type,
                "version": str(version) if version else "unknown",
                "connected": True
            }
    except Exception as e:
        logger.error(f"❌ Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "connected": False
        }


async def check_system_health() -> dict:
    """
    Check system health (CPU, memory, disk).
    
    Returns dict with CPU, memory, and disk metrics.
    """
    import psutil
    
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.5)
        
        # Memory usage
        memory = psutil.virtual_memory()
        
        # Disk usage
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
        logger.warning(f"⚠️ System health check failed: {e}")
        return {
            "status": "unknown",
            "error": str(e)
        }


async def check_app_health() -> dict:
    """
    Check application health.
    
    Returns application configuration and version info.
    """
    return {
        "status": "healthy",
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "root_path": ROOT_PATH or "/",
        "api_prefix": settings.API_V1_STR
    }


async def check_redis_health() -> dict:
    """
    Check Redis connectivity and health.
    
    Returns Redis connection status and version info.
    """
    r = get_redis()
    if r is None:
        return {"status": "unavailable", "connected": False}
    
    try:
        await r.ping()
        info = await r.info("server")
        return {
            "status": "healthy",
            "connected": True,
            "version": info.get("redis_version", "unknown"),
        }
    except Exception as e:
        logger.warning(f"⚠️ Redis health check failed: {e}")
        return {"status": "unhealthy", "connected": False, "error": str(e)}


# ==================== APPLICATION LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager - handles startup and shutdown events.
    
    Startup:
    - Logs startup information
    - Checks database connectivity
    - Initializes Redis
    - Initializes MinIO storage
    - Starts reminder scheduler
    
    Shutdown:
    - Stops reminder scheduler
    - Closes Redis connection
    - Closes database connections
    - Logs shutdown completion
    """
    # ==================== STARTUP ====================
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

    # Initialize Redis
    await init_redis()
    logger.info("✅ Redis initialized")

    # Initialize MinIO bucket
    minio_service.ensure_bucket()
    logger.info("✅ MinIO bucket ensured")

    # ==================== START REMINDER SCHEDULER ====================
    # Create a background task for the reminder scheduler
    # This will run in the background and send action reminders 3x daily
    scheduler_task = asyncio.create_task(reminder_scheduler.start())
    logger.info("✅ Meeting reminder scheduler started in background")

    # Store the task so we can cancel it on shutdown
    app.state.scheduler_task = scheduler_task

    yield  # ← Application runs here

    # ==================== SHUTDOWN CLEANUP ====================
    logger.info("🛑 Shutting down Action Tracker...")

    # Stop the reminder scheduler gracefully
    if hasattr(app.state, 'scheduler_task'):
        app.state.scheduler_task.cancel()
        try:
            await app.state.scheduler_task
        except asyncio.CancelledError:
            # Expected when cancelling the task
            pass
        logger.info("✅ Reminder scheduler stopped")

    # Close Redis connection
    await close_redis()
    logger.info("✅ Redis connection closed")

    # Close database connections
    if async_engine:
        await async_engine.dispose()
        logger.info("✅ Database connections closed")

    logger.info("🛑 Action Tracker shutdown complete")


# ==================== CREATE FASTAPI APPLICATION ====================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="EC Action Tracker - Meeting Management and Action Tracking System",
    lifespan=lifespan,
    docs_url=None,     # Served manually below
    redoc_url=None,
    openapi_url=None,
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==================== RATE LIMITER SETUP ====================
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ==================== CORS CONFIGURATION ====================

def get_cors_origins() -> list:
    """
    Get CORS origins with proper handling of DEV_CORS_ALLOW_ALL.
    
    Returns:
        List of allowed origins or ["*"] for development
    """
    # Check if DEV_CORS_ALLOW_ALL is enabled
    if settings.DEV_CORS_ALLOW_ALL:
        logger.warning("⚠️ DEV_CORS_ALLOW_ALL is enabled - allowing all origins (DEVELOPMENT ONLY)")
        return ["*"]
    
    # Get origins from settings
    origins = settings.CORS_ORIGINS
    
    # If no origins are configured and we're in development, use defaults
    if not origins and settings.IS_DEVELOPMENT:
        default_origins = [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://localhost:5173",
            "http://localhost:8001",
        ]
        logger.info(f"🔧 No CORS origins configured, using defaults: {default_origins}")
        return default_origins
    
    # Return configured origins
    return origins


def setup_cors(app: FastAPI) -> list:
    """
    Setup CORS middleware with proper configuration.
    
    Logs CORS configuration and checks for security issues in production.
    """
    # Get CORS origins
    cors_origins = get_cors_origins()
    
    # Log CORS configuration
    logger.info("=" * 60)
    logger.info("🌐 CORS CONFIGURATION")
    logger.info("=" * 60)
    logger.info(f"📋 DEV_CORS_ALLOW_ALL: {settings.DEV_CORS_ALLOW_ALL}")
    logger.info(f"📋 BACKEND_CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}")
    logger.info(f"📋 CORS_ORIGINS (final): {cors_origins}")
    logger.info(f"📋 Environment: {settings.ENVIRONMENT}")
    logger.info(f"📋 DEBUG: {settings.DEBUG}")
    logger.info("=" * 60)
    
    # Check for security issues in production
    if cors_origins == ["*"] and settings.IS_PRODUCTION:
        logger.critical("❌ CRITICAL: Allowing all CORS origins in PRODUCTION!")
        logger.critical("❌ This is a security risk! Please configure specific origins.")
        if not settings.DEV_CORS_ALLOW_ALL:
            logger.warning("⚠️ DEV_CORS_ALLOW_ALL is false, but CORS_ORIGINS is ['*']")
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "PATCH",
            "OPTIONS",
            "HEAD"
        ],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "X-CSRF-Token",
            "X-API-Key",
            "X-Total-Count",
            "X-Page",
            "X-Per-Page"
        ],
        expose_headers=[
            "Content-Type",
            "Authorization",
            "X-Total-Count",
            "X-Page",
            "X-Per-Page",
            "X-Request-ID"
        ],
        max_age=3600,  # Cache preflight requests for 1 hour
    )
    
    # Log success
    if cors_origins == ["*"]:
        logger.info("✅ CORS configured to allow ALL origins (development mode)")
    else:
        logger.info(f"✅ CORS configured with {len(cors_origins)} origins")
    
    return cors_origins


# Apply CORS configuration
CORS_ORIGINS_CONFIGURED = setup_cors(app)


# ==================== DEBUG ENDPOINTS ====================

@app.get("/debug/cors", tags=["Debug"])
async def debug_cors():
    """
    Debug endpoint to check CORS configuration.
    
    Returns current CORS settings and environment info.
    """
    return {
        "cors_origins": CORS_ORIGINS_CONFIGURED,
        "backend_cors_origins": settings.BACKEND_CORS_ORIGINS,
        "dev_cors_allow_all": settings.DEV_CORS_ALLOW_ALL,
        "environment": settings.ENVIRONMENT,
        "debug": settings.DEBUG,
        "is_production": settings.IS_PRODUCTION,
        "is_development": settings.IS_DEVELOPMENT,
        "root_path": ROOT_PATH,
    }


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
        "version": settings.VERSION,
        "reminder_scheduler": "running" if hasattr(app.state, 'scheduler_task') and not app.state.scheduler_task.done() else "stopped"
    }


@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    """
    Detailed health check endpoint.
    
    Returns comprehensive health information for all components.
    Returns 503 if overall status is unhealthy.
    """
    db_health, system_health, app_health, redis_health = await asyncio.gather(
        check_database_health(),
        check_system_health(),
        check_app_health(),
        check_redis_health(),
    )

    # Determine overall status
    overall_status = "healthy"
    if db_health["status"] != "healthy" or system_health["status"] not in ["healthy", "degraded"]:
        overall_status = "unhealthy"
    elif system_health["status"] == "degraded" or redis_health["status"] != "healthy":
        overall_status = "degraded"

    # Check scheduler status
    scheduler_status = "running" if hasattr(app.state, 'scheduler_task') and not app.state.scheduler_task.done() else "stopped"

    response = {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": None,
        "components": {
            "database": db_health,
            "system": system_health,
            "application": app_health,
            "redis": redis_health,
            "reminder_scheduler": {
                "status": scheduler_status,
                "running": scheduler_status == "running"
            }
        }
    }

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


# ==================== OPENAPI / SWAGGER ENDPOINTS ====================

@app.get("/openapi.json", include_in_schema=False)
async def custom_openapi():
    """
    Custom OpenAPI schema endpoint.
    
    Handles ROOT_PATH patching for token URL in production.
    """
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

    # Patch tokenUrl in securitySchemes so Swagger Authorize uses correct path
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
    """
    Custom Swagger UI endpoint.
    
    Provides interactive API documentation.
    """
    return get_swagger_ui_html(
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
    """
    Custom ReDoc endpoint.
    
    Provides read-only API documentation.
    """
    return get_redoc_html(
        openapi_url="./openapi.json",
        title=settings.PROJECT_NAME + " - ReDoc",
    )


# ==================== FRONTEND SERVING ====================

if not settings.DEBUG:
    """
    Serve frontend in production (DEBUG=False).
    
    Serves static files and SPA routing.
    """
    frontend_dist = get_frontend_path()

    if frontend_dist:
        logger.info(f"🎨 Serving frontend from: {frontend_dist}")

        # Mount assets directory if it exists
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        # Serve index.html
        @app.get("/", include_in_schema=False)
        async def serve_index():
            """Serve the frontend index.html file."""
            return FileResponse(frontend_dist / "index.html")

        # SPA routing fallback
        @app.get("/{path:path}", include_in_schema=False)
        async def serve_spa(path: str):
            """
            SPA routing fallback.
            
            Serves static files if they exist, otherwise falls back to index.html.
            """
            # Clean the path to handle potential leading slashes from proxies
            check_path = path.lstrip("/")

            # Exclude API and special endpoints
            excluded_prefixes = ("api/", "docs", "redoc", "openapi.json", "health", "debug")
            
            if any(check_path.startswith(prefix) for prefix in excluded_prefixes):
                raise HTTPException(status_code=404)

            # Try to serve the file directly
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