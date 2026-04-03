#!/usr/bin/env python3
"""
Seeder for Action Tracker attribute values
Run: python -m app.db.seeders.action_tracker_seeder
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.attribute import Attribute, AttributeValue
from app.db.base import Base

# Attribute codes
ATTRIBUTES = {
    "meeting_status": {
        "name": "Meeting Status",
        "description": "Status of meetings",
        "values": [
            {"code": "pending", "name": "Pending", "description": "Meeting scheduled but not started", "sort_order": 1},
            {"code": "started", "name": "Started", "description": "Meeting in progress", "sort_order": 2},
            {"code": "ended", "name": "Ended", "description": "Meeting ended", "sort_order": 3},
            {"code": "awaiting_action", "name": "Awaiting Action", "description": "Meeting completed, awaiting action items", "sort_order": 4},
            {"code": "closed", "name": "Closed", "description": "Meeting fully completed and closed", "sort_order": 5},
            {"code": "cancelled", "name": "Cancelled", "description": "Meeting cancelled", "sort_order": 6},
        ]
    },
    "action_status": {
        "name": "Action Status",
        "description": "Overall status of action items",
        "values": [
            {"code": "pending", "name": "Pending", "description": "Action not yet started", "sort_order": 1},
            {"code": "in_progress", "name": "In Progress", "description": "Action being worked on", "sort_order": 2},
            {"code": "completed", "name": "Completed", "description": "Action completed", "sort_order": 3},
            {"code": "overdue", "name": "Overdue", "description": "Action past due date", "sort_order": 4},
            {"code": "blocked", "name": "Blocked", "description": "Action blocked by dependency", "sort_order": 5},
            {"code": "cancelled", "name": "Cancelled", "description": "Action cancelled", "sort_order": 6},
        ]
    },
    "individual_status": {
        "name": "Individual Status",
        "description": "User's self-reported status for actions",
        "values": [
            {"code": "pending", "name": "Not Started", "description": "Haven't started yet", "sort_order": 1},
            {"code": "in_progress", "name": "In Progress", "description": "Actively working on it", "sort_order": 2},
            {"code": "blocked", "name": "Blocked", "description": "Stuck, need help", "sort_order": 3},
            {"code": "review", "name": "Ready for Review", "description": "Completed, awaiting review", "sort_order": 4},
            {"code": "completed", "name": "Completed", "description": "Fully completed", "sort_order": 5},
        ]
    },
    "document_type": {
        "name": "Document Type",
        "description": "Types of documents that can be attached to meetings",
        "values": [
            {"code": "agenda", "name": "Agenda", "description": "Meeting agenda document", "sort_order": 1},
            {"code": "presentation", "name": "Presentation", "description": "Presentation slides", "sort_order": 2},
            {"code": "report", "name": "Report", "description": "Meeting report", "sort_order": 3},
            {"code": "minutes", "name": "Minutes", "description": "Meeting minutes", "sort_order": 4},
            {"code": "attachment", "name": "Attachment", "description": "General attachment", "sort_order": 5},
            {"code": "reference", "name": "Reference", "description": "Reference material", "sort_order": 6},
        ]
    },
    "action_priority": {
        "name": "Action Priority",
        "description": "Priority levels for action items",
        "values": [
            {"code": "low", "name": "Low", "description": "Low priority", "sort_order": 1},
            {"code": "medium", "name": "Medium", "description": "Medium priority", "sort_order": 2},
            {"code": "high", "name": "High", "description": "High priority", "sort_order": 3},
            {"code": "urgent", "name": "Urgent", "description": "Urgent priority", "sort_order": 4},
        ]
    }
}


async def seed_attributes(db: AsyncSession):
    """Seed attribute values for action tracker"""
    
    for attr_code, attr_data in ATTRIBUTES.items():
        # Check if attribute exists
        result = await db.execute(
            select(Attribute).where(Attribute.code == attr_code)
        )
        attribute = result.scalar_one_or_none()
        
        if not attribute:
            attribute = Attribute(
                code=attr_code,
                name=attr_data["name"],
                description=attr_data["description"]
            )
            db.add(attribute)
            await db.flush()
            print(f"✅ Created attribute: {attr_code}")
        else:
            print(f"⚠️ Attribute already exists: {attr_code}")
        
        # Seed values
        for value_data in attr_data["values"]:
            result = await db.execute(
                select(AttributeValue).where(
                    AttributeValue.attribute_id == attribute.id,
                    AttributeValue.code == value_data["code"]
                )
            )
            value = result.scalar_one_or_none()
            
            if not value:
                value = AttributeValue(
                    attribute_id=attribute.id,
                    code=value_data["code"],
                    name=value_data["name"],
                    description=value_data["description"],
                    sort_order=value_data["sort_order"],
                    is_active=True
                )
                db.add(value)
                print(f"  ✅ Created value: {value_data['code']}")
            else:
                print(f"  ⚠️ Value already exists: {value_data['code']}")
    
    await db.commit()
    print("\n🎉 Action Tracker attributes seeded successfully!")


async def main():
    """Main seeder function"""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        await seed_attributes(db)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())