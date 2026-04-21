#!/usr/bin/env python3
"""
Database Initialization and Seeding Script for Action Tracker
Optimized for Docker with enhanced error handling and container support
"""

import asyncio
import os
import sys
import logging
import traceback
import subprocess
import signal
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse
import re
import getpass
from contextlib import asynccontextmanager
from functools import wraps

import asyncpg
import aiomysql
import aiosqlite
from sqlalchemy import text, select, func, inspect
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

# Add project root to path
project_root = str(Path(__file__).parent.parent.parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.config import settings
from app.db.base import AsyncSessionLocal, async_engine, Base
from app.models.user import User
from app.models.role import Role, Permission
from app.models.user_attribute import UserAttribute
from app.models.audit import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.general.dynamic_attribute import (
    AttributeGroup, Attribute, AttributeValue, EntityAttribute
)
from app.core.security import get_password_hash

# Configure logging for Docker
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Suppress noisy loggers
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
logging.getLogger('aiomysql').setLevel(logging.WARNING)

# ==================== DOCKER ENVIRONMENT DETECTION ====================

def is_running_in_docker() -> bool:
    """Detect if running inside Docker container"""
    return os.path.exists('/.dockerenv') or os.path.exists('/run/.containerenv')

def get_environment() -> str:
    """Get current environment (docker, development, production)"""
    if is_running_in_docker():
        return 'docker'
    return os.getenv('APP_ENV', 'development')

def get_retry_config() -> Dict[str, Any]:
    """Get retry configuration based on environment"""
    if get_environment() == 'docker':
        return {
            'max_retries': 30,
            'retry_delay': 2,
            'retry_backoff': 1.5
        }
    return {
        'max_retries': 5,
        'retry_delay': 1,
        'retry_backoff': 1
    }

# ==================== CONFIGURATION ====================

class SeedConfig:
    # API configuration (for shell scripts that need to call the API)
    DEFAULT_API_BASE_URL = getattr(settings, 'BACKEND_URL', 'http://127.0.0.1:8001')
    DEFAULT_API_USERNAME = os.getenv('ADMIN_USERNAME', getattr(settings, 'ADMIN_USERNAME', 'admin'))
    DEFAULT_API_PASSWORD = os.getenv('ADMIN_PASSWORD', getattr(settings, 'ADMIN_PASSWORD', 'Admin123!'))
    
    # Database connection uses DATABASE_URL from .env automatically
    PASSWORD_MAX_LENGTH = 72
    SKIP_SEED = os.getenv('SKIP_SEED', 'false').lower() == 'true'
    SEED_ONLY_IF_EMPTY = os.getenv('SEED_ONLY_IF_EMPTY', 'true').lower() == 'true'
    DROP_EXISTING = os.getenv('DROP_EXISTING_TABLES', 'false').lower() == 'true'


def truncate_password(password: str) -> str:
    return password[:SeedConfig.PASSWORD_MAX_LENGTH]


# ==================== RETRY DECORATOR ====================

def retry_on_failure(max_retries: int = None, delay: int = None, backoff: float = None):
    """Decorator to retry database operations on failure"""
    config = get_retry_config()
    max_retries = max_retries or config['max_retries']
    delay = delay or config['retry_delay']
    backoff = backoff or config['retry_backoff']
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except (OperationalError, ConnectionError, ConnectionRefusedError) as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(f"Retry {attempt + 1}/{max_retries} after {current_delay}s: {str(e)[:100]}")
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        logger.error(f"Failed after {max_retries} attempts")
                        raise
                except Exception as e:
                    logger.error(f"Non-retryable error: {e}")
                    raise
            
            raise last_exception
        return wrapper
    return decorator


# ==================== CONFIGURATION PROMPTS ====================

def get_config_from_user(api_base_url: Optional[str] = None,
                         api_username: Optional[str] = None,
                         api_password: Optional[str] = None) -> Tuple[str, str, str]:
    """
    Get API configuration for shell scripts (not database connection).
    Database connection always uses DATABASE_URL from .env file.
    """
    is_interactive = sys.stdin.isatty() and not is_running_in_docker()
    
    # Use provided values first
    if api_base_url:
        final_api_base_url = api_base_url
    elif not is_interactive:
        final_api_base_url = SeedConfig.DEFAULT_API_BASE_URL
    else:
        default_url = SeedConfig.DEFAULT_API_BASE_URL
        print("\n" + "=" * 60)
        print("  Action Tracker - SEED CONFIGURATION")
        print(f"  Environment: {get_environment()}")
        print("=" * 60)
        print(f"\n📌 NOTE: Database connection will use DATABASE_URL from .env file")
        print(f"   Current DATABASE_URL: {settings.DATABASE_URL}")
        print(f"\n📡 API Configuration (for shell scripts that need to call the API):")
        final_api_base_url = input(f"   Enter API base URL [{default_url}]: ").strip() or default_url
    
    if api_username:
        final_api_username = api_username
    elif not is_interactive:
        final_api_username = SeedConfig.DEFAULT_API_USERNAME
    else:
        default_username = SeedConfig.DEFAULT_API_USERNAME
        final_api_username = input(f"   Enter admin username for API calls [{default_username}]: ").strip() or default_username
    
    if api_password:
        final_api_password = truncate_password(api_password)
    elif not is_interactive:
        final_api_password = truncate_password(SeedConfig.DEFAULT_API_PASSWORD)
    else:
        default_password = SeedConfig.DEFAULT_API_PASSWORD
        pwd = getpass.getpass(f"   Enter admin password for API calls [{default_password}]: ") or default_password
        final_api_password = truncate_password(pwd)
    
    print()  # Empty line for spacing
    logger.info(f"🌐 API Base URL: {final_api_base_url}")
    logger.info(f"👤 API Username: {final_api_username}")
    logger.info(f"🔒 API Password: {'*' * len(final_api_password)}")
    
    return final_api_base_url, final_api_username, final_api_password


# ==================== FILE LOADERS ====================

class ConfigLoader:
    """Load configuration from text files with Docker support"""
    
    @staticmethod
    def load_permissions(file_path: Path) -> List[Dict[str, Any]]:
        """Load permissions from permissions.txt"""
        permissions = []
        
        if not file_path.exists():
            logger.warning(f"Permissions file not found: {file_path}")
            return permissions
        
        with open(file_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                try:
                    parts = line.split('|')
                    if len(parts) != 5:
                        logger.warning(f"Line {line_num}: Invalid format (expected 5 fields): {line}")
                        continue
                    
                    permission = {
                        'code': parts[0].strip(),
                        'name': parts[1].strip(),
                        'resource': parts[2].strip(),
                        'action': parts[3].strip(),
                        'is_system': parts[4].strip().lower() == 'true'
                    }
                    permissions.append(permission)
                except Exception as e:
                    logger.warning(f"Line {line_num}: Error parsing permission: {e}")
                    continue
        
        logger.info(f"📋 Loaded {len(permissions)} permissions from {file_path.name}")
        return permissions
    
    @staticmethod
    def load_roles(file_path: Path) -> List[Dict[str, Any]]:
        """Load roles from roles.txt"""
        roles = []
        
        if not file_path.exists():
            logger.warning(f"Roles file not found: {file_path}")
            return roles
        
        with open(file_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                try:
                    parts = line.split('|')
                    if len(parts) != 4:
                        logger.warning(f"Line {line_num}: Invalid format (expected 4 fields): {line}")
                        continue
                    
                    role = {
                        'code': parts[0].strip(),
                        'name': parts[1].strip(),
                        'description': parts[2].strip(),
                        'permissions': parts[3].strip().split(',') if parts[3].strip() != '*' else ['*']
                    }
                    roles.append(role)
                except Exception as e:
                    logger.warning(f"Line {line_num}: Error parsing role: {e}")
                    continue
        
        logger.info(f"📋 Loaded {len(roles)} roles from {file_path.name}")
        return roles
    
    @staticmethod
    def load_users(file_path: Path) -> List[Dict[str, Any]]:
        """Load users from users.txt"""
        users = []
        
        if not file_path.exists():
            logger.warning(f"Users file not found: {file_path}")
            return users
        
        with open(file_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                try:
                    parts = line.split('|')
                    if len(parts) != 8:
                        logger.warning(f"Line {line_num}: Invalid format (expected 8 fields): {line}")
                        continue
                    
                    user = {
                        'username': parts[0].strip(),
                        'email': parts[1].strip(),
                        'password': truncate_password(parts[2].strip()),
                        'first_name': parts[3].strip(),
                        'last_name': parts[4].strip(),
                        'is_verified': parts[5].strip().lower() == 'true',
                        'is_active': parts[6].strip().lower() == 'true',
                        'roles': [r.strip() for r in parts[7].strip().split(',') if r.strip()]
                    }
                    users.append(user)
                except Exception as e:
                    logger.warning(f"Line {line_num}: Error parsing user: {e}")
                    continue
        
        logger.info(f"📋 Loaded {len(users)} users from {file_path.name}")
        return users


# ==================== DATABASE TYPE DETECTION ====================

class DatabaseType:
    POSTGRESQL = 'postgresql'
    MYSQL = 'mysql'
    SQLITE = 'sqlite'
    UNKNOWN = 'unknown'
    
    @classmethod
    def detect(cls, db_url: str = None) -> str:
        db_url = (db_url or settings.DATABASE_URL).lower()
        if 'postgresql' in db_url or 'postgres' in db_url:
            return cls.POSTGRESQL
        elif 'mysql' in db_url or 'mariadb' in db_url:
            return cls.MYSQL
        elif 'sqlite' in db_url:
            return cls.SQLITE
        return cls.UNKNOWN


# ==================== DATABASE CREATION ====================

class DatabaseCreator:
    @staticmethod
    @retry_on_failure(max_retries=10, delay=3)
    async def create_if_not_exists() -> None:
        """Create database if it doesn't exist with retry logic"""
        db_type = DatabaseType.detect()
        logger.info(f"🔍 Database type detected: {db_type} (Environment: {get_environment()})")
        logger.info(f"📁 Using DATABASE_URL from .env: {settings.DATABASE_URL}")
        
        if db_type == DatabaseType.POSTGRESQL:
            await DatabaseCreator._create_postgresql(settings.DATABASE_URL)
        elif db_type == DatabaseType.MYSQL:
            await DatabaseCreator._create_mysql(settings.DATABASE_URL)
        elif db_type == DatabaseType.SQLITE:
            await DatabaseCreator._create_sqlite(settings.DATABASE_URL)
        else:
            logger.warning(f"⚠️ Automatic database creation not supported for {db_type}")
    
    @staticmethod
    async def _create_postgresql(db_url: str) -> None:
        clean_url = db_url.replace("+asyncpg", "")
        parsed = urlparse(clean_url)
        db_name = parsed.path.lstrip('/').split('?')[0]
        base_url = f"{parsed.scheme}://{parsed.netloc}/postgres"
        if parsed.query:
            base_url += f"?{parsed.query}"
        
        logger.info(f"🐘 Checking PostgreSQL database '{db_name}'...")
        
        try:
            conn = await asyncpg.connect(base_url, timeout=10.0)
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                logger.info(f"Creating database '{db_name}'...")
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                logger.info(f"✅ PostgreSQL database '{db_name}' created")
            else:
                logger.info(f"✅ PostgreSQL database '{db_name}' already exists")
            await conn.close()
        except Exception as e:
            logger.error(f"❌ Failed to create PostgreSQL database: {e}")
            raise
    
    @staticmethod
    async def _create_mysql(db_url: str) -> None:
        clean_url = re.sub(r"\+[^:/]+", "", db_url)
        parsed = urlparse(clean_url)
        db_name = parsed.path.lstrip('/').split('?')[0]
        host = parsed.hostname or '127.0.0.1'
        port = parsed.port or 3306
        user = parsed.username or 'root'
        password = parsed.password or ''
        
        logger.info(f"🐬 Checking MySQL database '{db_name}'...")
        logger.info(f"   Host: {host}:{port}")
        logger.info(f"   User: {user}")
        
        try:
            conn = await aiomysql.connect(
                host=host, port=port, user=user, password=password,
                charset='utf8mb4', autocommit=True, connect_timeout=10
            )
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                    (db_name,)
                )
                exists = await cursor.fetchone()
                if not exists:
                    logger.info(f"Creating database '{db_name}'...")
                    await cursor.execute(
                        f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                        f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                    )
                    logger.info(f"✅ MySQL database '{db_name}' created")
                else:
                    logger.info(f"✅ MySQL database '{db_name}' already exists")
            conn.close()
        except Exception as e:
            logger.error(f"❌ Failed to create MySQL database: {e}")
            logger.error(f"   Please ensure MySQL is running and credentials are correct")
            raise
    
    @staticmethod
    async def _create_sqlite(db_url: str) -> None:
        if 'sqlite:///' in db_url:
            db_path = db_url.split('sqlite:///')[-1].split('?')[0]
            if db_path != ':memory:':
                db_file = Path(db_path)
                db_file.parent.mkdir(parents=True, exist_ok=True)
                async with aiosqlite.connect(db_path) as conn:
                    await conn.execute("SELECT 1")
                logger.info(f"✅ SQLite database at: {db_path}")
        else:
            logger.info("🗄️ Using in-memory SQLite database")


# ==================== TABLE MANAGEMENT ====================

class TableManager:
    @staticmethod
    async def create_tables(drop_existing: bool = False, check_first: bool = True) -> bool:
        """Create database tables"""
        logger.info("=" * 60)
        logger.info("🔨 CREATING DATABASE TABLES")
        logger.info("=" * 60)
        
        metadata_tables = list(Base.metadata.tables.keys())
        logger.info(f"📋 Tables to create ({len(metadata_tables)}):")
        for table in sorted(metadata_tables):
            logger.info(f"   - {table}")
        
        if not metadata_tables:
            logger.error("❌ No tables found in metadata!")
            return False
        
        try:
            async with async_engine.begin() as conn:
                if drop_existing:
                    logger.info("🗑️ Dropping existing tables...")
                    await conn.run_sync(Base.metadata.drop_all)
                    logger.info("✅ Existing tables dropped")
                    await asyncio.sleep(1)
                
                logger.info("🏗️ Creating new tables...")
                await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=check_first))
                logger.info("✅ Table creation completed")
            
            await asyncio.sleep(1)
            created_tables = await TableManager._get_existing_tables()
            missing = [t for t in metadata_tables if t not in created_tables]
            if missing:
                logger.warning(f"⚠️ Missing tables after creation: {missing}")
            else:
                logger.info("✅ All tables created successfully")
            
            return True
        except SQLAlchemyError as e:
            logger.error(f"❌ SQLAlchemy error: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            logger.error(traceback.format_exc())
            return False
    
    @staticmethod
    async def tables_exist() -> bool:
        """Check if any tables exist in the database"""
        try:
            async with async_engine.connect() as conn:
                db_type = DatabaseType.detect()
                if db_type == DatabaseType.MYSQL:
                    result = await conn.execute(text("SHOW TABLES"))
                elif db_type == DatabaseType.POSTGRESQL:
                    result = await conn.execute(text("""
                        SELECT table_name FROM information_schema.tables 
                        WHERE table_schema = 'public'
                    """))
                else:
                    result = await conn.execute(text("""
                        SELECT name FROM sqlite_master 
                        WHERE type='table' AND name NOT LIKE 'sqlite_%'
                    """))
                tables = result.fetchall()
                return len(tables) > 0
        except Exception as e:
            logger.debug(f"Error checking tables: {e}")
            return False
    
    @staticmethod
    async def _get_existing_tables() -> List[str]:
        db_type = DatabaseType.detect()
        async with async_engine.connect() as conn:
            if db_type == DatabaseType.POSTGRESQL:
                result = await conn.execute(text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """))
            elif db_type == DatabaseType.MYSQL:
                result = await conn.execute(text("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = DATABASE()
                """))
            elif db_type == DatabaseType.SQLITE:
                result = await conn.execute(text("""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """))
            else:
                def get_tables(sync_conn):
                    inspector = inspect(sync_conn)
                    return inspector.get_table_names()
                return await conn.run_sync(get_tables)
            return [row[0] for row in result.fetchall()]


# ==================== DATA SEEDING ====================

class PermissionSeeder:
    @staticmethod
    async def seed(db: AsyncSession, permissions: List[Dict[str, Any]]) -> int:
        """Seed permissions from loaded data"""
        from app.models.role import Permission
        
        created = 0
        for perm_data in permissions:
            result = await db.execute(select(Permission).where(Permission.code == perm_data["code"]))
            existing = result.scalar_one_or_none()
            if not existing:
                perm = Permission(**perm_data)
                db.add(perm)
                created += 1
        await db.commit()
        logger.info(f"   ✅ Created {created} permissions")
        return created


class RoleSeeder:
    @staticmethod
    async def seed(db: AsyncSession, roles: List[Dict[str, Any]], permissions: List[Dict[str, Any]]) -> int:
        """Seed roles from loaded data"""
        from app.models.role import Role, Permission
        from app.models.role import role_permissions
        
        perm_lookup = {}
        for perm in permissions:
            result = await db.execute(select(Permission).where(Permission.code == perm["code"]))
            perm_obj = result.scalar_one_or_none()
            if perm_obj:
                perm_lookup[perm["code"]] = perm_obj
        
        created = 0
        for role_data in roles:
            result = await db.execute(select(Role).where(Role.code == role_data["code"]))
            existing = result.scalar_one_or_none()
            if not existing:
                role = Role(
                    name=role_data["name"],
                    code=role_data["code"],
                    description=role_data["description"]
                )
                db.add(role)
                await db.flush()
                
                if role_data["permissions"] != ["*"]:
                    for perm_code in role_data["permissions"]:
                        if perm_code in perm_lookup:
                            await db.execute(
                                role_permissions.insert().values(
                                    role_id=role.id, permission_id=perm_lookup[perm_code].id
                                )
                            )
                created += 1
                logger.debug(f"   Created role: {role_data['name']}")
        
        await db.commit()
        logger.info(f"   ✅ Created {created} roles")
        return created


class UserSeeder:
    @staticmethod
    async def seed(db: AsyncSession, users: List[Dict[str, Any]]) -> int:
        """Seed users from loaded data"""
        from app.models.user import User
        from app.models.role import Role
        from app.models.user import user_roles
        
        created = 0
        for user_data in users:
            result = await db.execute(select(User).where(User.username == user_data["username"]))
            existing = result.scalar_one_or_none()
            if not existing:
                new_user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    is_verified=user_data["is_verified"],
                    is_active=user_data["is_active"]
                )
                db.add(new_user)
                await db.flush()
                
                for role_name in user_data["roles"]:
                    role_result = await db.execute(select(Role).where(Role.code == role_name))
                    role_obj = role_result.scalar_one_or_none()
                    if role_obj:
                        await db.execute(
                            user_roles.insert().values(
                                user_id=new_user.id, role_id=role_obj.id
                            )
                        )
                created += 1
                logger.info(f"   ✅ Created user: {user_data['username']}")
        
        await db.commit()
        logger.info(f"✅ Created {created} users")
        return created


# ==================== DOCKER-OPTIMIZED SCRIPT RUNNER ====================

async def run_shell_scripts(scripts_dir: Path, api_base_url: str, api_username: str, api_password: str):
    """Run all .sh scripts with Docker-optimized execution"""
    if not scripts_dir.exists():
        logger.warning(f"Scripts directory not found: {scripts_dir}")
        return
    
    sh_scripts = sorted(scripts_dir.glob("*.sh"))
    
    if not sh_scripts:
        logger.info("No .sh scripts found in scripts directory")
        return
    
    logger.info(f"\n📁 Found {len(sh_scripts)} shell scripts to run")
    logger.info(f"🌐 Scripts will use API: {api_base_url}")
    logger.info(f"👤 Scripts will use user: {api_username}")
    
    for script_path in sh_scripts:
        script_name = script_path.name
        logger.info(f"\n{'='*60}")
        logger.info(f"📌 Running: {script_name}")
        logger.info(f"{'='*60}")
        
        try:
            os.chmod(script_path, 0o755)
            
            # Set environment variables for scripts
            env = os.environ.copy()
            env.update({
                'API_BASE_URL': api_base_url,
                'ADMIN_USERNAME': api_username,
                'ADMIN_PASSWORD': api_password,
                'DOCKER_ENV': str(is_running_in_docker()),
                'APP_ENV': get_environment()
            })
            
            process = await asyncio.create_subprocess_exec(
                str(script_path), api_base_url, api_username, api_password,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env
            )
            
            stdout, stderr = await process.communicate()
            
            if stdout:
                print(stdout.decode())
            if stderr:
                print(stderr.decode(), file=sys.stderr)
            
            if process.returncode == 0:
                logger.info(f"✅ Completed: {script_name}")
            else:
                logger.warning(f"⚠️ Failed: {script_name} (exit code: {process.returncode})")
                
        except Exception as e:
            logger.error(f"❌ Error running {script_name}: {e}")
        
        await asyncio.sleep(1)


class SummaryReporter:
    @staticmethod
    async def report(db: AsyncSession) -> None:
        from app.models.role import Role
        from app.models.user import User
        
        role_count = await db.scalar(select(func.count()).select_from(Role))
        user_count = await db.scalar(select(func.count()).select_from(User))
        
        role_counts = await db.execute(
            select(Role.name, func.count(User.id))
            .join(Role.users)
            .group_by(Role.name)
        )
        
        logger.info("\n" + "=" * 60)
        logger.info("📊 SEEDING SUMMARY")
        logger.info("=" * 60)
        logger.info(f"  - Environment: {get_environment()}")
        logger.info(f"  - Docker: {'Yes' if is_running_in_docker() else 'No'}")
        logger.info(f"  - Database URL: {settings.DATABASE_URL}")
        logger.info(f"  - Roles: {role_count}")
        logger.info(f"  - Users: {user_count}")
        
        if role_count > 0:
            logger.info("\n📋 Role Breakdown:")
            for role_name, count in role_counts:
                logger.info(f"  - {role_name}: {count} users")
        
        logger.info("=" * 60)


# ==================== HEALTH CHECK ====================

async def health_check() -> bool:
    """Perform health check on database"""
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return False


# ==================== MAIN INITIALIZATION ====================

async def init_db(drop_existing: bool = None, 
                  api_base_url: str = None, 
                  api_username: str = None, 
                  api_password: str = None) -> None:
    """Main database initialization with Docker optimizations"""
    start_time = time.time()
    
    logger.info("=" * 60)
    logger.info("🚀 Action Tracker - DATABASE INITIALIZATION")
    logger.info(f"   Environment: {get_environment()}")
    logger.info(f"   Docker: {'Yes' if is_running_in_docker() else 'No'}")
    logger.info(f"   Database URL: {settings.DATABASE_URL}")
    logger.info(f"   Skip Seed: {SeedConfig.SKIP_SEED}")
    logger.info("=" * 60)
    
    drop_existing = drop_existing if drop_existing is not None else SeedConfig.DROP_EXISTING
    
    current_project_root = Path(__file__).parent.parent.parent.parent
    seed_dir = Path(__file__).parent
    scripts_dir = seed_dir / "scripts"
    
    permissions_file = seed_dir / "permissions.txt"
    roles_file = seed_dir / "roles.txt"
    users_file = seed_dir / "users.txt"
    
    try:
        # Step 1: Create database if it doesn't exist
        await DatabaseCreator.create_if_not_exists()
        
        # Step 2: Verify connection with retry
        logger.info("Verifying database connection...")
        if not await health_check():
            raise Exception("Database connection failed")
        logger.info("✅ Database connection verified")
        
        # Step 3: Create tables FIRST (before checking for existing data)
        logger.info("Creating database tables...")
        tables_created = await TableManager.create_tables(drop_existing=drop_existing, check_first=True)
        
        if not tables_created:
            logger.warning("⚠️ Some tables may not have been created, continuing anyway...")
        
        # Step 4: Check if seeding is needed (now tables exist)
        should_seed = not SeedConfig.SKIP_SEED
        
        if should_seed and SeedConfig.SEED_ONLY_IF_EMPTY:
            async with AsyncSessionLocal() as check_db:
                # Check if users table exists and has data
                try:
                    user_count = await check_db.scalar(select(func.count()).select_from(User))
                    if user_count > 0:
                        logger.info(f"Database already has {user_count} users. Skipping seed.")
                        should_seed = False
                    else:
                        logger.info("Database is empty, proceeding with seed...")
                except Exception as e:
                    logger.info(f"Users table may not exist yet: {e}")
                    should_seed = True
        
        # Step 5: Seed data if needed
        if should_seed:
            # Load configuration from files
            logger.info("\n📁 Loading configuration files...")
            permissions = ConfigLoader.load_permissions(permissions_file)
            roles = ConfigLoader.load_roles(roles_file)
            users = ConfigLoader.load_users(users_file)
            
            if not permissions:
                logger.error("❌ No permissions loaded. Cannot proceed.")
                return
            if not roles:
                logger.error("❌ No roles loaded. Cannot proceed.")
                return
            if not users:
                logger.error("❌ No users loaded. Cannot proceed.")
                return
            
            # Seed permissions, roles, and users
            async with AsyncSessionLocal() as db:
                logger.info("\n📝 Seeding permissions...")
                await PermissionSeeder.seed(db, permissions)
                
                logger.info("\n📝 Seeding roles...")
                await RoleSeeder.seed(db, roles, permissions)
                
                logger.info("\n📝 Seeding users...")
                await UserSeeder.seed(db, users)
                
                await db.commit()
                
                await SummaryReporter.report(db)
        else:
            logger.info("Seeding skipped (database already has data or SKIP_SEED=true)")
        
        # Step 6: Run shell scripts (unless skipped)
        if not SeedConfig.SKIP_SEED:
            logger.info("\n" + "=" * 60)
            logger.info("📜 RUNNING SHELL SCRIPTS")
            logger.info("=" * 60)
            
            final_api_base_url = api_base_url or SeedConfig.DEFAULT_API_BASE_URL
            final_api_username = api_username or SeedConfig.DEFAULT_API_USERNAME
            final_api_password = api_password or SeedConfig.DEFAULT_API_PASSWORD
            
            await run_shell_scripts(scripts_dir, final_api_base_url, final_api_username, final_api_password)
        else:
            logger.info("Shell scripts skipped (SKIP_SEED=true)")
        
        elapsed_time = time.time() - start_time
        logger.info("\n" + "=" * 60)
        logger.info(f"✨ DATABASE INITIALIZATION COMPLETED (took {elapsed_time:.2f}s)")
        logger.info("=" * 60)
        
        if get_environment() == 'docker':
            logger.info("\n💡 Docker Tips:")
            logger.info("   - To re-seed: docker-compose exec app python app/db/seed/seed_data.py --drop")
            logger.info("   - To skip seeding: docker-compose run -e SKIP_SEED=true app")
            logger.info("   - View logs: docker-compose logs -f app")
        
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        logger.debug(traceback.format_exc())
        raise
    finally:
        await async_engine.dispose()


async def main(drop_existing: bool = False, 
               api_base_url: str = None, 
               api_username: str = None, 
               api_password: str = None) -> None:
    """Main entry point with signal handling for Docker"""
    
    # Handle graceful shutdown in Docker
    def signal_handler():
        logger.info("Received shutdown signal, cleaning up...")
        asyncio.create_task(async_engine.dispose())
        sys.exit(0)
    
    signal.signal(signal.SIGTERM, lambda s, f: signal_handler())
    signal.signal(signal.SIGINT, lambda s, f: signal_handler())
    
    api_base_url, api_username, api_password = get_config_from_user(
        api_base_url, api_username, api_password
    )
    await init_db(
        drop_existing=drop_existing, 
        api_base_url=api_base_url, 
        api_username=api_username, 
        api_password=api_password
    )


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Initialize and seed Action Tracker database")
    parser.add_argument("url", nargs="?", type=str, help="API base URL (positional argument)")
    parser.add_argument("username", nargs="?", type=str, help="Admin username (positional argument)")
    parser.add_argument("password", nargs="?", type=str, help="Admin password (positional argument)")
    parser.add_argument("--drop", action="store_true", help="Drop existing tables before creating")
    parser.add_argument("--api-baseurl", type=str, help="API base URL for shell scripts (alternative to positional)")
    parser.add_argument("--api-username", type=str, dest="api_username", help="Admin username for API calls (alternative to positional)")
    parser.add_argument("--api-password", type=str, dest="api_password", help="Admin password for API calls (alternative to positional)")
    parser.add_argument("--skip-seed", action="store_true", help="Skip database seeding")
    parser.add_argument("--force", action="store_true", help="Force seeding even if data exists")
    args = parser.parse_args()
    
    if args.skip_seed:
        os.environ['SKIP_SEED'] = 'true'
    
    if args.force:
        os.environ['SEED_ONLY_IF_EMPTY'] = 'false'
    
    # Determine API credentials from positional or named arguments
    api_base_url = args.url or args.api_baseurl
    api_username = args.username or args.api_username