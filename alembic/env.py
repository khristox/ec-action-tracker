"""Alembic environment configuration with multi-database support."""

import sys
from pathlib import Path
from logging.config import fileConfig
from configparser import ConfigParser
from urllib.parse import urlparse
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text, pool  # Add pool here
from alembic import context

# ==================== PATH & ENVIRONMENT SETUP ====================
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables
env_path = project_root / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Database type detection
DATABASE_URL = os.getenv("DATABASE_URL", "")
DB_TYPE = 'unknown'
if 'postgresql' in DATABASE_URL or 'postgres' in DATABASE_URL:
    DB_TYPE = 'postgresql'
elif 'mysql' in DATABASE_URL:
    DB_TYPE = 'mysql'
elif 'sqlite' in DATABASE_URL:
    DB_TYPE = 'sqlite'

def get_sync_url(async_url: str) -> str:
    """Convert async database URL to sync version for Alembic."""
    if DB_TYPE == 'postgresql':
        return async_url.replace("+asyncpg", "").replace("postgresql+psycopg2", "postgresql")
    elif DB_TYPE == 'mysql':
        if "aiomysql" in async_url:
            return async_url.replace("+aiomysql", "+pymysql")
        elif "asyncmy" in async_url:
            return async_url.replace("+asyncmy", "+pymysql")
        elif "pymysql" not in async_url:
            # If no driver specified, add pymysql
            parsed = urlparse(async_url)
            return f"mysql+pymysql://{parsed.netloc}{parsed.path}"
        return async_url
    elif DB_TYPE == 'sqlite':
        return async_url.replace("+aiosqlite", "")
    return async_url

SYNC_DATABASE_URL = get_sync_url(DATABASE_URL)

print(f"🔍 Database Type: {DB_TYPE}")
print(f"📌 Alembic using sync URL: {SYNC_DATABASE_URL}")

# ==================== ALEMBIC CONFIG ====================
config = context.config

# Disable interpolation to handle % characters
if config.config_file_name:
    parser = ConfigParser(interpolation=None)
    parser.read(config.config_file_name)
    config.file_config = parser

# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the sync database URL
config.set_main_option("sqlalchemy.url", SYNC_DATABASE_URL)

# ==================== APP IMPORTS ====================
# Import Base from base_class to avoid async engine
try:
    from app.db.base_class import Base
    print("✅ Imported Base from base_class")
except ImportError:
    print("⚠️ base_class not found, trying alternative import...")
    # Alternative: import Base from base without creating async engine
    from sqlalchemy.ext.declarative import declarative_base
    Base = declarative_base()
    print("✅ Created Base declarative_base directly")

# Import models to register with Base.metadata
try:
    
    from app.models.refresh_token import RefreshToken
    from app.models.audit import AuditLog
    print("✅ Models imported successfully")
except ImportError as e:
    print(f"⚠️ Model import warning: {e}")

# Metadata for autogenerate
target_metadata = Base.metadata

# ==================== MIGRATION FUNCTIONS ====================

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (synchronously)."""
    # Create sync engine - pool is already imported from sqlalchemy
    engine = create_engine(
        SYNC_DATABASE_URL,
        poolclass=pool.NullPool,  # Now pool is defined
        echo=False
    )
    
    with engine.connect() as connection:
        # Database-specific setup
        if DB_TYPE == 'mysql':
            connection.execute(text("SET time_zone = '+00:00';"))
            connection.commit()
        elif DB_TYPE == 'sqlite':
            connection.execute(text("PRAGMA foreign_keys = ON;"))
            connection.commit()
        elif DB_TYPE == 'postgresql':
            connection.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
            connection.commit()
        
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        
        with context.begin_transaction():
            context.run_migrations()
    
    engine.dispose()


# ==================== MAIN EXECUTION ====================
print(f"🚀 Starting migrations for {DB_TYPE} database...")

if context.is_offline_mode():
    print("📡 Running in OFFLINE mode")
    run_migrations_offline()
else:
    print("📡 Running in ONLINE mode")
    try:
        run_migrations_online()
        print("✅ Migrations completed successfully!")
    except Exception as e:
        print(f"❌ Migrations failed: {e}")
        import traceback
        traceback.print_exc()
        raise