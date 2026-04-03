# app/api/v1/endpoints/attribute_groups/__init__.py
from fastapi import APIRouter
from . import routes

router = APIRouter()

# Include all routes
router.include_router(routes.router, tags=["attribute-groups"])