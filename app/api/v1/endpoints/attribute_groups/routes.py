# app/api/v1/endpoints/attribute_groups/routes.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from app.api import deps
from . import get, post, put, delete, bulk

router = APIRouter()

# Include all route modules
router.include_router(get.router, prefix="", tags=["attribute-groups-get"])
router.include_router(post.router, prefix="", tags=["attribute-groups-post"])
router.include_router(put.router, prefix="", tags=["attribute-groups-put"])
router.include_router(delete.router, prefix="", tags=["attribute-groups-delete"])
router.include_router(bulk.router, prefix="/bulk", tags=["attribute-groups-bulk"])

logger = logging.getLogger(__name__)