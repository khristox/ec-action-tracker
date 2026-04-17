# app/api/v1/api.py
from fastapi import APIRouter
import logging

from app.api.v1.endpoints.action_tracker import router as action_tracker_router

logger = logging.getLogger(__name__)

# Import routers with debug
try:
    from app.api.v1.endpoints.auth import router as auth_router
    from app.api.v1.endpoints.users import router as users_router
    from app.api.v1.endpoints.roles import router as roles_router
    from app.api.v1.endpoints.permissions import router as permissions_router
    from app.api.v1.endpoints.admin import router as admin_router
    from app.api.v1.endpoints.audit import router as audit_router
    from app.api.v1.endpoints.attribute_groups import router as attribute_groups_router
    from app.api.v1.endpoints.attributes import router as attributes_router
    from app.api.v1.endpoints.address.locations import router as locations_router
    from app.api.v1.endpoints.menus import router as menus_router
    
    logger.info("✅ All routers imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import router: {e}")
    raise

# Create main API router
api_router = APIRouter()

# Authentication & User Management
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(roles_router, prefix="/roles", tags=["roles"])
api_router.include_router(permissions_router, prefix="/permissions", tags=["permissions"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

# System & Audit
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(attribute_groups_router, prefix="/attribute-groups", tags=["attribute-groups"])
api_router.include_router(attributes_router, prefix="/attributes", tags=["attributes"])

# Locations & Menus
api_router.include_router(locations_router, prefix="/locations", tags=["locations"])
api_router.include_router(menus_router, prefix="/menus", tags=["menus"])

api_router.include_router(menus_router, prefix="/action-tracker", tags=["menus"])


# Action Tracker (this already includes all sub-routers)
api_router.include_router(action_tracker_router, prefix="/action-tracker", tags=["action-tracker-documents"])

# DO NOT add import_export separately here - it should be inside action_tracker_router

# Log summary
logger.info(f"✅ API Router configured with {len(api_router.routes)} routes")