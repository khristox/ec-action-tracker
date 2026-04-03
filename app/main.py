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
from typing import Dict, Any, List, Optional
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
    """Application state container with metrics"""
    start_time: float = 0
    database_connected: bool = False
    request_count: int = 0
    error_count: int = 0
    last_error: Optional[str] = None

app_state = AppState()


# ==================== FRONTEND PATH CONFIGURATION ====================

def get_frontend_path() -> Optional[Path]:
    """
    Get the path to the frontend dist directory
    """
    # Possible locations
    candidates = [
        Path(__file__).parent.parent.parent / "frontend" / "rms" / "dist",
        Path.cwd() / "frontend" / "rms" / "dist",
        Path("/home/chris/Chr/Apps/ECATMIS/frontend/dist"),
    ]
    
    # Check environment variable
    frontend_path_env = os.getenv("FRONTEND_DIST_PATH")
    if frontend_path_env:
        candidates.insert(0, Path(frontend_path_env))
    
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            logger.info(f"✅ Found frontend build at: {candidate}")
            return candidate
    
    logger.warning("⚠️ Frontend build not found")
    return None


# ==================== LIFESPAN MANAGER ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.
    """
    # ==================== STARTUP ====================
    logger.info("=" * 70)
    logger.info("🚀 Action Tracker STARTUP")
    logger.info("=" * 70)
    
    app_state.start_time = time.time()
    
    # Log configuration
    logger.info(f"📌 Project: {settings.PROJECT_NAME}")
    logger.info(f"📌 Version: {settings.VERSION}")
    logger.info(f"📌 Environment: {settings.ENVIRONMENT}")
    logger.info(f"📌 Debug Mode: {settings.DEBUG}")
    logger.info(f"📌 API Prefix: {settings.API_V1_STR}")
    
    # Log frontend configuration
    frontend_dist = get_frontend_path()
    if frontend_dist and frontend_dist.exists():
        logger.info(f"🎨 Frontend Build Found: {frontend_dist}")
    else:
        logger.info("📦 Frontend not built - API only mode")
    
    # Test database connection
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
    
    # Log CORS settings
    cors_origins = settings.CORS_ORIGINS
    if cors_origins:
        logger.info(f"🔒 CORS Allowed Origins: {len(cors_origins)} configured")
        if settings.DEBUG:
            logger.debug(f"   Origins: {cors_origins}")
    else:
        logger.warning("⚠️  No CORS origins configured - API may not be accessible from browsers")
    
    logger.info("=" * 70)
    logger.info("✨ Application Ready")
    logger.info(f"🌐 API Documentation: http://localhost:8001/docs")
    logger.info(f"🔍 Health Check: http://localhost:8001/health")
    logger.info("=" * 70)
    
    yield
    
    # ==================== SHUTDOWN ====================
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
    logger.info(f"⏱️  Uptime: {uptime:.2f} seconds")
    logger.info(f"📊 Total Requests: {app_state.request_count}")
    logger.info(f"❌ Total Errors: {app_state.error_count}")
    logger.info("=" * 70)


# ==================== CREATE FASTAPI APP ====================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Action Tracker for Electoral Commission - Meeting and Task Management",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ==================== TEMPORARY FIX: DIRECT MENUS ROUTER MOUNT ====================
# This bypasses the main API router to debug the 404 issue
# Remove this section once the issue is resolved

try:
    from app.api.v1.endpoints.menus import router as menus_router_direct
    
    # Mount menus router directly at /api/v1/menus
    app.include_router(menus_router_direct, prefix=f"{settings.API_V1_STR}/menus", tags=["menus"])
    
    logger.info("=" * 70)
    logger.info("✅ DIRECT MENUS ROUTER MOUNTED (TEMPORARY FIX)")
    logger.info(f"   Menus available at: {settings.API_V1_STR}/menus/")
    
    # List all menu routes for debugging
    menu_routes_count = 0
    for route in menus_router_direct.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            methods = list(route.methods) if route.methods else []
            logger.info(f"   → {methods} {settings.API_V1_STR}/menus{route.path}")
            menu_routes_count += 1
    
    logger.info(f"   Total menu routes mounted: {menu_routes_count}")
    logger.info("=" * 70)
    
except ImportError as e:
    logger.error(f"❌ Failed to import menus router directly: {e}")
    logger.error("   Make sure app/api/v1/endpoints/menus.py exists")
except Exception as e:
    logger.error(f"❌ Error mounting menus router directly: {e}")
    import traceback
    traceback.print_exc()

# ==================== MIDDLEWARE ====================

# Request counter middleware
@app.middleware("http")
async def count_requests(request: Request, call_next):
    """Count requests and measure response time"""
    start_time = time.time()
    app_state.request_count += 1
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    
    if process_time > 1.0:
        logger.warning(f"Slow request: {request.method} {request.url.path} - {process_time:.2f}s")
    
    return response

# Audit Middleware
app.add_middleware(AuditMiddleware)

# CORS Middleware
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
    
    # Log warning if using wildcard in production
    if cors_origins == ["*"] and settings.ENVIRONMENT == "production":
        logger.warning("⚠️  CORS allows all origins in production - this is not recommended!")
else:
    logger.warning("⚠️  CORS not configured - API may not be accessible from browsers")


# ==================== EXCEPTION HANDLERS ====================

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions"""
    app_state.error_count += 1
    app_state.last_error = exc.detail
    
    logger.warning(f"HTTP {exc.status_code}: {exc.detail} - {request.method} {request.url.path}")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "path": request.url.path,
                "method": request.method,
                "timestamp": time.time()
            }
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    app_state.error_count += 1
    
    errors = []
    for error in exc.errors():
        errors.append({
            "field": " -> ".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"]
        })
    
    logger.warning(f"Validation Error: {request.method} {request.url.path} - {len(errors)} errors")
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": 422,
                "message": "Validation error",
                "details": errors,
                "path": request.url.path,
                "timestamp": time.time()
            }
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions"""
    app_state.error_count += 1
    app_state.last_error = str(exc)
    
    error_id = f"{int(time.time())}-{app_state.error_count}"
    
    logger.error(f"Unhandled Exception [{error_id}]: {exc}")
    logger.debug(traceback.format_exc())
    
    error_detail = str(exc) if settings.DEBUG else "An internal error occurred"
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": 500,
                "message": error_detail,
                "error_id": error_id,
                "path": request.url.path,
                "timestamp": time.time()
            }
        }
    )


# ==================== PUBLIC ENDPOINTS ====================

@app.get("/health", tags=["System"])
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for monitoring"""
    uptime = time.time() - app_state.start_time if app_state.start_time else 0
    
    is_healthy = app_state.database_connected
    status_code = 200 if is_healthy else 503
    
    return JSONResponse(
        status_code=status_code,
        content={
            "success": is_healthy,
            "data": {
                "status": "healthy" if is_healthy else "degraded",
                "database": "connected" if app_state.database_connected else "disconnected",
                "version": settings.VERSION,
                "environment": settings.ENVIRONMENT,
                "uptime": uptime,
                "uptime_human": format_uptime(uptime),
                "timestamp": time.time(),
                "requests_total": app_state.request_count,
                "errors_total": app_state.error_count
            }
        }
    )


@app.get("/info", tags=["System"])
async def system_info() -> Dict[str, Any]:
    """Detailed system information"""
    uptime = time.time() - app_state.start_time if app_state.start_time else 0
    
    # Get registered endpoints
    endpoints = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            endpoints.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": route.name if hasattr(route, "name") else None
            })
    
    return {
        "success": True,
        "data": {
            "project": {
                "name": settings.PROJECT_NAME,
                "version": settings.VERSION,
            },
            "configuration": {
                "environment": settings.ENVIRONMENT,
                "debug": settings.DEBUG,
                "api_prefix": settings.API_V1_STR,
                "database_connected": app_state.database_connected,
                "cors_enabled": bool(settings.CORS_ORIGINS),
                "cors_origins": settings.CORS_ORIGINS if settings.DEBUG else None
            },
            "statistics": {
                "uptime": uptime,
                "uptime_human": format_uptime(uptime),
                "requests": app_state.request_count,
                "errors": app_state.error_count,
                "success_rate": round((app_state.request_count - app_state.error_count) / max(app_state.request_count, 1) * 100, 2)
            },
            "timestamp": time.time()
        }
    }


@app.get("/debug-routes", tags=["Debug"])
async def debug_routes():
    """Debug endpoint to list all registered routes"""
    routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            routes.append({
                "path": route.path,
                "methods": list(route.methods) if route.methods else [],
                "name": route.name if hasattr(route, "name") else None
            })
    
    # Filter to show only relevant routes
    menu_routes = [r for r in routes if "menu" in r["path"].lower()]
    api_routes = [r for r in routes if r["path"].startswith("/api")]
    
    return {
        "total_routes": len(routes),
        "menu_routes_count": len(menu_routes),
        "api_routes_count": len(api_routes),
        "menu_routes": menu_routes[:20],  # Show first 20
        "api_routes": api_routes[:20]  # Show first 20
    }


@app.options("/test-cors")
async def test_cors_options():
    """CORS preflight test endpoint"""
    return JSONResponse(content={"message": "CORS preflight successful"})


@app.get("/test-cors")
async def test_cors_get():
    """CORS GET test endpoint"""
    return JSONResponse(content={
        "message": "CORS GET successful",
        "cors_origins": settings.CORS_ORIGINS,
        "debug": settings.DEBUG
    })


def format_uptime(seconds: float) -> str:
    """Format uptime in human readable format"""
    if seconds < 60:
        return f"{seconds:.0f} seconds"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.0f} minutes"
    elif seconds < 86400:
        hours = seconds / 3600
        return f"{hours:.1f} hours"
    else:
        days = seconds / 86400
        return f"{days:.1f} days"


# ==================== FRONTEND SERVING ====================

frontend_dist = get_frontend_path()

if frontend_dist and frontend_dist.exists() and not settings.DEBUG:
    logger.info("🎨 Serving frontend in production mode")
    
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        logger.info(f"   Mounted assets from: {assets_dir}")
    
    @app.get("/")
    async def serve_index():
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return JSONResponse({"error": "Frontend not found"}, status_code=404)
    
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        # Skip API routes
        if path.startswith(("api/", "docs/", "redoc/", "openapi.json", "health", "info", "test-cors", "debug-routes")):
            raise HTTPException(status_code=404, detail="Not found")
        
        file_path = frontend_dist / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        
        index_path = frontend_dist / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not found")
    
    logger.info(f"🎨 Frontend serving enabled from: {frontend_dist}")
else:
    if frontend_dist and frontend_dist.exists():
        logger.info("🔧 Frontend build found but DEBUG mode is ON. Set DEBUG=False to serve frontend.")
    else:
        logger.info("📦 Frontend not built - API only mode")


# ==================== API ROUTES ====================
# Mount the main API router
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