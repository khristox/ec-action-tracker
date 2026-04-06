import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.general.dynamic_attribute import Attribute

logger = logging.getLogger(__name__)

async def get_valid_meeting_statuses(db: AsyncSession) -> List[Dict[str, Any]]:
    try:
        stmt = select(
            Attribute.id,
            Attribute.code,
            Attribute.name,
            Attribute.short_name,
            Attribute.description,
            Attribute.extra_metadata,
            Attribute.sort_order
        ).where(
            Attribute.code.like("MEETING_STATUS_%"),
            Attribute.is_active == True
        ).order_by(Attribute.sort_order)
        result = await db.execute(stmt)
        rows = result.all()
        statuses = []
        for row in rows:
            statuses.append({
                "id": str(row[0]),
                "code": row[1],
                "name": row[2],
                "short_name": row[3].lower() if row[3] else None,
                "description": row[4],
                "extra_metadata": row[5],
                "sort_order": row[6]
            })
        return statuses
    except Exception as e:
        logger.error(f"Error fetching meeting statuses: {e}")
        return []

async def get_valid_status_short_names(db: AsyncSession) -> List[str]:
    statuses = await get_valid_meeting_statuses(db)
    return [s["short_name"] for s in statuses if s.get("short_name")]

async def get_status_by_short_name(db: AsyncSession, short_name: str) -> Optional[Dict[str, Any]]:
    statuses = await get_valid_meeting_statuses(db)
    target = short_name.lower()
    for status in statuses:
        if status.get("short_name") and status["short_name"].lower() == target:
            return status
    return None

async def get_status_id_by_short_name(db: AsyncSession, short_name: str) -> Optional[UUID]:
    status = await get_status_by_short_name(db, short_name)
    return UUID(status["id"]) if status else None