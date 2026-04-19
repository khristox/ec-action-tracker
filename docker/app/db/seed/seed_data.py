#!/usr/bin/env python3
"""
Database Initialization and Seeding Script for Action Tracker
"""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from sqlalchemy import text, select
from app.db.base import AsyncSessionLocal, async_engine, Base
from app.models.user import User
from app.core.security import get_password_hash
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db(drop_existing: bool = False):
    logger.info("Starting database initialization...")
    async with async_engine.begin() as conn:
        if drop_existing:
            await conn.run_sync(Base.metadata.drop_all)
            logger.info("Dropped existing tables")
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Created tables")
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        admin = result.scalar_one_or_none()
        if not admin:
            admin = User(
                username="admin",
                email="admin@example.com",
                first_name="Admin",
                last_name="User",
                hashed_password=get_password_hash(os.getenv("ADMIN_PASSWORD", "Admin123!")),
                is_active=True,
                is_verified=True
            )
            db.add(admin)
            await db.commit()
            logger.info("Created admin user")
    
    logger.info("Database initialization completed!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--drop", action="store_true")
    args = parser.parse_args()
    asyncio.run(init_db(drop_existing=args.drop))
