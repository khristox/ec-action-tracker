# app/api/v1/endpoints/admin_charts.py
from fastapi import Depends
from sqlalchemy.orm import Session

from app.api import deps
from app.api.v1.endpoints.action_tracker import router
from app.models.chart_data import ChartConfiguration
from app.models.user import User
from app.schemas.chart_data import ChartConfigCreate


@router.post("/chart-configurations")
async def create_chart_config(
    config: ChartConfigCreate,
    current_user: User = Depends(deps.get_current_admin),
    db: Session = Depends(deps.get_db)
):
    """Create a new chart configuration"""
    db_config = ChartConfiguration(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return {"success": True, "data": db_config}

@router.get("/chart-configurations")
async def get_chart_configurations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_admin),
    db: Session = Depends(deps.get_db)
):
    """Get all chart configurations"""
    configs = db.query(ChartConfiguration).offset(skip).limit(limit).all()
    return {"success": True, "data": configs}