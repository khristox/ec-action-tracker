# app/db/seed/seed_chart_data.py
"""
Chart Data Seeder for Action Tracker
Seeds chart configurations and sample cache data
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Add project root to path
project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.db.base import Base

logger = logging.getLogger(__name__)


class ChartDataSeeder:
    """Seeder for chart configurations and sample data"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    @staticmethod
    def get_chart_configs() -> List[Dict[str, Any]]:
        """Get default chart configurations"""
        return [
            {
                "name": "weekly_activity",
                "title": "Weekly Activity",
                "chart_type": "bar",
                "data_category": "tasks",
                "config": {
                    "xAxisLabel": "Day",
                    "yAxisLabel": "Number of Tasks",
                    "showLegend": True,
                    "colors": ["#1976d2", "#2e7d32"],
                    "borderRadius": 6
                },
                "query_config": {"days": 7, "include_completed": True},
                "is_default": True,
                "display_order": 1
            },
            {
                "name": "status_distribution",
                "title": "Task Status Distribution",
                "chart_type": "doughnut",
                "data_category": "tasks",
                "config": {
                    "showLegend": True,
                    "showPercentage": True,
                    "colors": ["#ed6c02", "#1976d2", "#2e7d32", "#d32f2f"],
                    "cutout": "50%"
                },
                "query_config": {},
                "is_default": True,
                "display_order": 2
            },
            {
                "name": "monthly_trend",
                "title": "Monthly Trend",
                "chart_type": "line",
                "data_category": "tasks",
                "config": {
                    "xAxisLabel": "Month",
                    "yAxisLabel": "Number of Tasks",
                    "showLegend": True,
                    "fill": True,
                    "tension": 0.4
                },
                "query_config": {"months": 6},
                "is_default": True,
                "display_order": 3
            },
            {
                "name": "priority_distribution",
                "title": "Priority Distribution",
                "chart_type": "pie",
                "data_category": "tasks",
                "config": {
                    "showLegend": True,
                    "showPercentage": True,
                    "colors": ["#d32f2f", "#ed6c02", "#2e7d32", "#0288d1"]
                },
                "query_config": {},
                "is_default": True,
                "display_order": 4
            },
            {
                "name": "meeting_trends",
                "title": "Meeting Trends",
                "chart_type": "line",
                "data_category": "meetings",
                "config": {
                    "xAxisLabel": "Month",
                    "yAxisLabel": "Number of Meetings",
                    "showLegend": True,
                    "fill": True
                },
                "query_config": {"months": 6},
                "is_default": False,
                "display_order": 5
            },
            {
                "name": "completion_rate",
                "title": "Task Completion Rate",
                "chart_type": "bar",
                "data_category": "performance",
                "config": {
                    "xAxisLabel": "User",
                    "yAxisLabel": "Completion Rate (%)",
                    "showLegend": False,
                    "colors": ["#10B981"]
                },
                "query_config": {"limit": 10},
                "is_default": False,
                "display_order": 6
            },
            {
                "name": "workload_distribution",
                "title": "Workload Distribution",
                "chart_type": "horizontalBar",
                "data_category": "tasks",
                "config": {
                    "xAxisLabel": "Number of Tasks",
                    "yAxisLabel": "User",
                    "showLegend": False,
                    "colors": ["#8B5CF6"]
                },
                "query_config": {"limit": 10},
                "is_default": False,
                "display_order": 7
            }
        ]
    
    async def seed_chart_configurations(self, force: bool = False) -> Dict[str, Any]:
        """Seed chart configurations"""
        from app.models.chart_data import ChartConfiguration
        
        # Check if already seeded
        result = await self.db.execute(select(func.count()).select_from(ChartConfiguration))
        existing_count = result.scalar() or 0
        
        if existing_count > 0 and not force:
            return {
                "status": "skipped",
                "message": f"Chart configurations already exist ({existing_count} found)",
                "seeded": 0
            }
        
        if force and existing_count > 0:
            # Clear existing
            await self.db.execute(ChartConfiguration.__table__.delete())
            await self.db.commit()
            logger.info("🗑️ Cleared existing chart configurations")
        
        configs = self.get_chart_configs()
        created = 0
        
        for config_data in configs:
            try:
                # Check if exists by name
                result = await self.db.execute(
                    select(ChartConfiguration).where(ChartConfiguration.name == config_data["name"])
                )
                existing = result.scalar_one_or_none()
                
                if not existing:
                    from app.models.chart_data import ChartConfiguration
                    chart_config = ChartConfiguration(**config_data)
                    self.db.add(chart_config)
                    created += 1
                    logger.debug(f"   Created chart config: {config_data['name']}")
            except Exception as e:
                logger.warning(f"   Failed to create {config_data['name']}: {e}")
        
        await self.db.commit()
        return {
            "status": "success",
            "message": f"Seeded {created} chart configurations",
            "seeded": created
        }
    
    async def seed_sample_cache_data(self, force: bool = False) -> Dict[str, Any]:
        """Seed sample chart data in cache for testing"""
        from app.models.chart_data import ChartDataCache
        import random
        
        # Clear existing sample data if force
        if force:
            await self.db.execute(
                ChartDataCache.__table__.delete().where(
                    ChartDataCache.cache_key.like("%_sample")
                )
            )
            await self.db.commit()
            logger.info("🗑️ Cleared existing sample cache data")
        
        cache_entries = []
        
        # 1. Weekly activity sample
        weekly_data = {
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": [random.randint(5, 20) for _ in range(7)],
                    "backgroundColor": "#1976d2",
                    "borderRadius": 6
                },
                {
                    "label": "Tasks Completed",
                    "data": [random.randint(3, 18) for _ in range(7)],
                    "backgroundColor": "#2e7d32",
                    "borderRadius": 6
                }
            ]
        }
        cache_entries.append({
            "cache_key": "weekly_activity_sample",
            "data": weekly_data,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        
        # 2. Status distribution sample
        status_data = {
            "labels": ["Pending", "In Progress", "Completed", "Overdue"],
            "datasets": [{
                "data": [random.randint(10, 30) for _ in range(4)],
                "backgroundColor": ["#ed6c02", "#1976d2", "#2e7d32", "#d32f2f"],
                "borderWidth": 0
            }]
        }
        cache_entries.append({
            "cache_key": "status_distribution_sample",
            "data": status_data,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        
        # 3. Monthly trend sample
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        monthly_data = {
            "labels": months,
            "datasets": [
                {
                    "label": "Tasks Created",
                    "data": [random.randint(20, 50) for _ in range(6)],
                    "borderColor": "#1976d2",
                    "backgroundColor": "rgba(25, 118, 210, 0.1)",
                    "fill": True,
                    "tension": 0.4
                },
                {
                    "label": "Tasks Completed",
                    "data": [random.randint(15, 45) for _ in range(6)],
                    "borderColor": "#2e7d32",
                    "backgroundColor": "rgba(46, 125, 50, 0.1)",
                    "fill": True,
                    "tension": 0.4
                }
            ]
        }
        cache_entries.append({
            "cache_key": "monthly_trend_sample",
            "data": monthly_data,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        
        # 4. Priority distribution sample
        priority_data = {
            "labels": ["High", "Medium", "Low", "Very Low"],
            "datasets": [{
                "data": [random.randint(5, 25) for _ in range(4)],
                "backgroundColor": ["#d32f2f", "#ed6c02", "#2e7d32", "#0288d1"],
                "borderWidth": 0
            }]
        }
        cache_entries.append({
            "cache_key": "priority_distribution_sample",
            "data": priority_data,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        
        # 5. Meeting trends sample
        meeting_data = {
            "labels": months,
            "datasets": [{
                "label": "Meetings",
                "data": [random.randint(5, 15) for _ in range(6)],
                "borderColor": "#9c27b0",
                "backgroundColor": "rgba(156, 39, 176, 0.1)",
                "fill": True,
                "tension": 0.4
            }]
        }
        cache_entries.append({
            "cache_key": "meeting_trends_sample",
            "data": meeting_data,
            "expires_at": datetime.utcnow() + timedelta(days=7)
        })
        
        created = 0
        for entry in cache_entries:
            try:
                # Check if exists
                result = await self.db.execute(
                    select(ChartDataCache).where(ChartDataCache.cache_key == entry["cache_key"])
                )
                existing = result.scalar_one_or_none()
                
                if not existing:
                    cache_entry = ChartDataCache(**entry)
                    self.db.add(cache_entry)
                    created += 1
            except Exception as e:
                logger.warning(f"Failed to create cache entry {entry['cache_key']}: {e}")
        
        await self.db.commit()
        return {
            "status": "success",
            "message": f"Seeded {created} sample cache entries",
            "seeded": created
        }
    
    async def seed_all(self, force: bool = False) -> Dict[str, Any]:
        """Run all seeding operations"""
        results = {
            "configurations": await self.seed_chart_configurations(force),
            "sample_cache": await self.seed_sample_cache_data(force)
        }
        return results


async def seed_chart_data(force: bool = False, skip_if_exists: bool = True) -> Dict[str, Any]:
    """Main function to seed chart data"""
    logger.info("=" * 60)
    logger.info("📊 SEEDING CHART DATA")
    logger.info("=" * 60)
    
    async with AsyncSessionLocal() as db:
        seeder = ChartDataSeeder(db)
        results = await seeder.seed_all(force=force)
        
        logger.info("\n📈 Chart Seeding Results:")
        for key, result in results.items():
            logger.info(f"   - {key}: {result.get('message', result.get('status', 'unknown'))}")
        
        return results


async def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed chart data for Action Tracker")
    parser.add_argument("--force", action="store_true", help="Force re-seed (clear existing data)")
    parser.add_argument("--skip-configs", action="store_true", help="Skip seeding configurations")
    parser.add_argument("--skip-cache", action="store_true", help="Skip seeding sample cache")
    
    args = parser.parse_args()
    
    logger.info(f"Starting chart data seeding...")
    logger.info(f"Force mode: {args.force}")
    
    try:
        async with AsyncSessionLocal() as db:
            seeder = ChartDataSeeder(db)
            
            if not args.skip_configs:
                result = await seeder.seed_chart_configurations(force=args.force)
                logger.info(f"Configurations: {result['message']}")
            
            if not args.skip_cache:
                result = await seeder.seed_sample_cache_data(force=args.force)
                logger.info(f"Sample cache: {result['message']}")
        
        logger.info("✅ Chart data seeding completed!")
        
    except Exception as e:
        logger.error(f"❌ Chart data seeding failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())