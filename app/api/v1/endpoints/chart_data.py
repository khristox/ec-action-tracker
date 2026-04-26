# app/api/v1/endpoints/chart_data.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from starlette import status

from app.api import deps
from app.models.user import User
from app.services.chart_data_service import ChartDataService
from app.schemas.chart_data import ChartDataResponse, ChartConfigResponse

router = APIRouter()

def is_admin(user: User) -> bool:
    """Check if user has admin or super_admin role"""
    return any(role.code in ["admin", "super_admin"] for role in user.roles)

@router.get("/weekly-activity", response_model=ChartDataResponse)
async def get_weekly_activity(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get weekly task creation and completion activity"""
    service = ChartDataService(db)
    
    cache_key = f"weekly_activity_{current_user.id}_{days}"
    
    async def compute():
        return await service.get_weekly_activity(
            user_id=current_user.id if not is_admin(current_user) else None,
            days=days
        )
    
    # ADD AWAIT HERE - This was missing
    data = await service.get_cached_or_compute(cache_key, compute)
    return ChartDataResponse(success=True, data=data)

@router.get("/status-distribution", response_model=ChartDataResponse)
async def get_status_distribution(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get task status distribution"""
    service = ChartDataService(db)
    
    cache_key = f"status_distribution_{current_user.id}"
    
    async def compute():
        return await service.get_status_distribution(
            user_id=current_user.id if not is_admin(current_user) else None
        )
    
    # ADD AWAIT HERE
    data = await service.get_cached_or_compute(cache_key, compute, ttl_minutes=15)
    return ChartDataResponse(success=True, data=data)

@router.get("/monthly-trend", response_model=ChartDataResponse)
async def get_monthly_trend(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get monthly task trends"""
    service = ChartDataService(db)
    
    cache_key = f"monthly_trend_{current_user.id}_{months}"
    
    async def compute():
        return await service.get_monthly_trend(
            user_id=current_user.id if not is_admin(current_user) else None,
            months=months
        )
    
    # ADD AWAIT HERE
    data = await service.get_cached_or_compute(cache_key, compute, ttl_minutes=30)
    return ChartDataResponse(success=True, data=data)

@router.get("/priority-distribution", response_model=ChartDataResponse)
async def get_priority_distribution(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get task priority distribution"""
    service = ChartDataService(db)
    
    cache_key = f"priority_distribution_{current_user.id}"
    
    async def compute():
        return await service.get_priority_distribution(
            user_id=current_user.id if not is_admin(current_user) else None
        )
    
    # ADD AWAIT HERE
    data = await service.get_cached_or_compute(cache_key, compute, ttl_minutes=15)
    return ChartDataResponse(success=True, data=data)

@router.get("/meeting-trends", response_model=ChartDataResponse)
async def get_meeting_trends(
    months: int = Query(6, ge=1, le=24),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get meeting trends over time"""
    service = ChartDataService(db)
    
    cache_key = f"meeting_trends_{months}"
    
    async def compute():
        return await service.get_meeting_trends(months=months)
    
    # ADD AWAIT HERE
    data = await service.get_cached_or_compute(cache_key, compute, ttl_minutes=60)
    return ChartDataResponse(success=True, data=data)

@router.get("/completion-rates", response_model=ChartDataResponse)
async def get_completion_rates(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get user completion rates (admin only)"""
    # Check if user has admin role using roles collection
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    
    service = ChartDataService(db)
    
    cache_key = f"completion_rates_{limit}"
    
    async def compute():
        return await service.get_completion_rate_by_user(limit=limit)
    
    # ADD AWAIT HERE
    data = await service.get_cached_or_compute(cache_key, compute, ttl_minutes=30)
    return ChartDataResponse(success=True, data=data)

@router.post("/refresh-cache")
async def refresh_chart_cache(
    cache_key: Optional[str] = None,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Refresh chart data cache"""
    # Check if user has admin role using roles collection
    if not is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin access required"
        )
    
    # Import your ChartDataCache model
    from app.models.chart_data import ChartDataCache
    from sqlalchemy import delete
    
    # Build delete query
    query = delete(ChartDataCache)
    if cache_key:
        query = query.where(ChartDataCache.cache_key == cache_key)
    
    result = await db.execute(query)
    await db.commit()
    
    return {
        "success": True,
        "message": f"Cleared {result.rowcount} cache entries"
    }