# app/api/v1/endpoints/action_tracker/router.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.api import deps
from app.models.user import User
from . import participants, participant_lists, meetings, minutes, actions, documents, dashboard
from .status_utils import get_valid_meeting_statuses

router = APIRouter()

# Include all sub‑routers
router.include_router(participants.router, prefix="/participants", tags=["participants"])
router.include_router(participant_lists.router, prefix="/participant-lists", tags=["participant-lists"])
router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])  # ← This must exist
router.include_router(minutes.router, prefix="/minutes", tags=["minutes"])
router.include_router(actions.router, prefix="/actions", tags=["actions"])
router.include_router(documents.router, prefix="/documents", tags=["documents"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])

# Top‑level debug endpoints
@router.get("/ping")
async def ping():
    return {"message": "pong", "status": "ok", "timestamp": datetime.now().isoformat()}

@router.get("/health")
async def action_tracker_health():
    return {"status": "healthy", "module": "action-tracker"}