# app/api/v1/endpoints/action_tracker/status_utils.py

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID
import json

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.general.dynamic_attribute import Attribute

logger = logging.getLogger(__name__)

async def get_valid_meeting_statuses(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get all valid meeting statuses from Attribute table"""
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
            # Get short_name from the column or from extra_metadata
            short_name = row[3]  # This is the short_name column
            if not short_name and row[5]:
                metadata = row[5]
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except:
                        pass
                if isinstance(metadata, dict):
                    short_name = metadata.get('short_name')
            
            # Convert short_name to lowercase for consistent matching
            if short_name:
                short_name = short_name.lower()
            
            statuses.append({
                "id": str(row[0]),
                "code": row[1],
                "name": row[2],
                "short_name": short_name or row[2].lower().replace(' ', '_'),
                "description": row[4],
                "extra_metadata": row[5],
                "sort_order": row[6] or 0
            })
        return statuses
    except Exception as e:
        logger.error(f"Error fetching meeting statuses: {e}")
        return []


async def get_status_by_short_name(db: AsyncSession, short_name: str, code_prefix: str = "MEETING_STATUS_%"):
    """Get status from attributes table by short_name (case-insensitive) with an optional code prefix filter safely."""
    result = await db.execute(
        select(Attribute).where(
            Attribute.code.like(code_prefix),
            or_(
                func.lower(Attribute.short_name) == func.lower(short_name),
                func.lower(Attribute.name) == func.lower(short_name),
                func.lower(Attribute.code) == func.lower(short_name),
            ),
            Attribute.is_active == True
        )
    )
    # Use .scalars().first() to guarantee safe recovery if multiple rows match
    return result.scalars().first()


async def get_status_id_by_short_name(db: AsyncSession, short_name: str, code_prefix: str = "MEETING_STATUS_%"):
    """Get status ID from attributes table by short_name (case-insensitive)."""
    status = await get_status_by_short_name(db, short_name, code_prefix=code_prefix)
    return status.id if status else None


async def get_valid_status_short_names(db: AsyncSession, code_prefix: Optional[str] = None) -> List[str]:
    """Get list of valid status short names with an optional prefix filter."""
    if code_prefix == "MEETING_STATUS_%" or code_prefix is None:
        statuses = await get_valid_meeting_statuses(db)
        if statuses:
            return [s["short_name"] for s in statuses if s.get("short_name")]

    # Fallback or general prefix query
    stmt = select(Attribute.short_name).where(Attribute.is_active == True)
    if code_prefix:
        stmt = stmt.where(Attribute.code.like(code_prefix))
        
    result = await db.execute(stmt)
    return [r[0] for r in result.all() if r[0]]