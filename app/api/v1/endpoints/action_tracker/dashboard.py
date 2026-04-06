from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.api import deps
from app.models.user import User
from app.crud.action_tracker import dashboard
from app.schemas.action_tracker import MeetingSummary, ActionSummary

router = APIRouter()

@router.get("/summary", response_model=MeetingSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await dashboard.get_summary(db)

@router.get("/actions-summary", response_model=ActionSummary)
async def get_actions_summary(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await dashboard.get_actions_summary(db)

@router.get("/statistics/meetings-by-month")
async def get_meetings_by_month(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
    year: int = Query(datetime.now().year),
):
    return await dashboard.get_meetings_by_month(db, year)

@router.get("/statistics/actions-by-status")
async def get_actions_by_status(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    return await dashboard.get_actions_by_status(db)