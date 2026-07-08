# app/api/v1/endpoints/action_tracker/router.py
"""
Action Tracker Router

This module serves as the main router for all action tracker related endpoints.
It aggregates and includes all sub-routers for different features.
"""

import logging
from datetime import datetime
from typing import Dict, Any

from app.api.v1.endpoints import notifications
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.user import User
from app.core.config import settings

# Import sub-routers
from . import (
    participants,
    participant_lists,
    meetings,
    minutes,
    actions,
    documents,
    dashboard,
    import_export
    
)
from .status_utils import get_valid_meeting_statuses

logger = logging.getLogger(__name__)

# Create main router
router = APIRouter()

# ==================== ROUTER CONFIGURATION ====================

# Define prefix and tags for better API documentation
ROUTER_CONFIG = {
    "participants": {"prefix": "/participants", "tags": ["participants"]},
    "participant_lists": {"prefix": "/participant-lists", "tags": ["participant-lists"]},
    "meetings": {"prefix": "/meetings", "tags": ["meetings"]},
    "minutes": {"prefix": "/minutes", "tags": ["minutes"]},
    "actions": {"prefix": "/actions", "tags": ["actions"]},
    "documents": {"prefix": "/documents", "tags": ["documents"]},
    "dashboard": {"prefix": "/dashboard", "tags": ["dashboard"]},
    "import_export": {"prefix": "/participants", "tags": ["import-export"]},
    "notifications": {"prefix": "/notifications", "tags": ["notifications"]},
}

# ==================== INCLUDE SUB-ROUTERS ====================

# Include all sub-routers with their configurations
router.include_router(
    participants.router,
    prefix=ROUTER_CONFIG["participants"]["prefix"],
    tags=ROUTER_CONFIG["participants"]["tags"]
)

router.include_router(
    participant_lists.router,
    prefix=ROUTER_CONFIG["participant_lists"]["prefix"],
    tags=ROUTER_CONFIG["participant_lists"]["tags"]
)

router.include_router(
    meetings.router,
    prefix=ROUTER_CONFIG["meetings"]["prefix"],
    tags=ROUTER_CONFIG["meetings"]["tags"]
)

router.include_router(
    minutes.router,
    prefix=ROUTER_CONFIG["minutes"]["prefix"],
    tags=ROUTER_CONFIG["minutes"]["tags"]
)

router.include_router(
    actions.router,
    prefix=ROUTER_CONFIG["actions"]["prefix"],
    tags=ROUTER_CONFIG["actions"]["tags"]
)

router.include_router(
    documents.router,
    prefix=ROUTER_CONFIG["documents"]["prefix"],
    tags=ROUTER_CONFIG["documents"]["tags"]
)

router.include_router(
    dashboard.router,
    prefix=ROUTER_CONFIG["dashboard"]["prefix"],
    tags=ROUTER_CONFIG["dashboard"]["tags"]
)

router.include_router(
    import_export.router,
    prefix=ROUTER_CONFIG["import_export"]["prefix"],
    tags=ROUTER_CONFIG["import_export"]["tags"]
)

router.include_router(
    notifications.router,
    prefix=ROUTER_CONFIG["notifications"]["prefix"],
    tags=ROUTER_CONFIG["notifications"]["tags"]
)

# Log the number of routes loaded
logger.info(f"✅ Action Tracker Router initialized with {len(router.routes)} routes")

# ==================== HEALTH & STATUS ENDPOINTS ====================

@router.get(
    "/ping",
    summary="Ping endpoint",
    description="Simple ping endpoint to check if the service is alive",
    response_model=Dict[str, Any],
    tags=["health"]
)
async def ping() -> Dict[str, Any]:
    """
    Ping endpoint for health checks.

    Returns:
        Dict containing status, message, and timestamp
    """
    return {
        "message": "pong",
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "action-tracker",
        "version": getattr(settings, "VERSION", "1.0.0"),
    }


@router.get(
    "/health",
    summary="Health check",
    description="Detailed health check endpoint for the action tracker module",
    response_model=Dict[str, Any],
    tags=["health"]
)
async def action_tracker_health(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    Comprehensive health check for the action tracker module.

    Checks:
        - Database connectivity
        - Module status
        - Service availability

    Returns:
        Dict containing health status and module information
    """
    health_status = {
        "status": "healthy",
        "module": "action-tracker",
        "timestamp": datetime.now().isoformat(),
        "version": getattr(settings, "VERSION", "1.0.0"),
        "environment": getattr(settings, "ENVIRONMENT", "development"),
        "routes_count": len(router.routes),
        "checks": {
            "database": "unknown",
            "redis": "unknown",
        }
    }

    # Check database connectivity
    try:
        # Execute a simple query to check database
        await db.execute("SELECT 1")
        health_status["checks"]["database"] = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        health_status["checks"]["database"] = "unhealthy"
        health_status["status"] = "degraded"

    # Check Redis connectivity (if configured)
    try:
        from app.core.redis_client import redis_client
        if redis_client:
            await redis_client.ping()
            health_status["checks"]["redis"] = "healthy"
        else:
            health_status["checks"]["redis"] = "not_configured"
    except ImportError:
        health_status["checks"]["redis"] = "not_configured"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        health_status["checks"]["redis"] = "unhealthy"
        if health_status["status"] == "healthy":
            health_status["status"] = "degraded"

    # Return appropriate status code based on health
    if health_status["status"] == "degraded":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service is degraded but operational"
        )

    return health_status


@router.get(
    "/info",
    summary="Module information",
    description="Get detailed information about the action tracker module",
    response_model=Dict[str, Any],
    tags=["health"]
)
async def module_info(
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    Get detailed module information including available endpoints and features.

    Returns:
        Dict containing module metadata and endpoint information
    """
    # Collect available sub-modules
    sub_modules = []
    for name, config in ROUTER_CONFIG.items():
        sub_modules.append({
            "name": name,
            "prefix": config["prefix"],
            "tags": config["tags"],
        })

    return {
        "module": "action-tracker",
        "version": getattr(settings, "VERSION", "1.0.0"),
        "sub_modules": sub_modules,
        "total_routes": len(router.routes),
        "features": [
            "meeting_management",
            "participant_management",
            "minutes_management",
            "action_tracking",
            "document_management",
            "dashboard",
            "import_export",
            "notifications",
        ],
        "timestamp": datetime.now().isoformat(),
    }


@router.get(
    "/valid-statuses",
    summary="Get valid meeting statuses",
    description="Returns a list of valid meeting statuses for the action tracker",
    response_model=Dict[str, Any],
    tags=["statuses"]
)
async def get_valid_statuses(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    Get all valid meeting statuses.

    Returns:
        Dict containing list of valid statuses
    """
    try:
        statuses = await get_valid_meeting_statuses(db)
        return {
            "statuses": statuses,
            "count": len(statuses),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to get valid statuses: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve valid statuses"
        )


@router.get(
    "/sub-modules",
    summary="List sub-modules",
    description="List all sub-modules registered in the action tracker",
    response_model=Dict[str, Any],
    tags=["health"]
)
async def list_sub_modules(
    current_user: User = Depends(deps.get_current_user),
) -> Dict[str, Any]:
    """
    List all sub-modules with their prefixes and tags.

    Returns:
        Dict containing list of sub-modules
    """
    return {
        "sub_modules": [
            {
                "name": name,
                "prefix": config["prefix"],
                "tags": config["tags"],
            }
            for name, config in ROUTER_CONFIG.items()
        ],
        "total": len(ROUTER_CONFIG),
        "timestamp": datetime.now().isoformat(),
    }


# ==================== ERROR HANDLERS ====================

# Optional: Add custom exception handlers for the action tracker router
# These can be added if needed for specific error handling

# ==================== INITIALIZATION LOGGING ====================

logger.info("🚀 Action Tracker Router initialized successfully")
logger.info(f"📊 Registered {len(router.routes)} routes")
logger.info(f"📦 Sub-modules: {', '.join(ROUTER_CONFIG.keys())}")