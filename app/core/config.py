# app/core/config.py
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Union, Any
from pydantic import AnyHttpUrl, Field, field_validator, ValidationInfo, SecretStr
from enum import Enum
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def is_running_in_docker() -> bool:
    """Detect if running inside Docker container"""
    return os.path.exists('/.dockerenv') or os.getenv('IN_DOCKER', 'false').lower() == 'true'


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class Settings(BaseSettings):
    # ========== APP SETTINGS ==========
    PROJECT_NAME: str = "Action Tracker API"
    PROJECT_TAGLINE: str = "Manage Your Properties Efficiently"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False
    API_BASE_URL: Optional[AnyHttpUrl] = Field(
        default="http://localhost:8001",
        description="Base URL for API endpoints"
    )
    
    # ========== AUDIT LOG SETTINGS ==========
    LOG_API_ACCESS: bool = True
    LOG_ALL_API_ACCESS: bool = False
    AUDIT_LOG_RETENTION_DAYS: int = 90
    
    # ========== CORS SETTINGS ==========
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8001",
        ]
    )
    DEV_CORS_ALLOW_ALL: bool = False
    
    # ========== DATABASE SETTINGS ==========
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_ECHO: bool = False
    SQL_ECHO: bool = False
    DB_MAX_RETRIES: int = 30
    DB_RETRY_DELAY: int = 2
    
    # ========== SECURITY SETTINGS ==========
    SECRET_KEY: SecretStr
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_SECRET_KEY: Optional[SecretStr] = Field(
        default=None,
        description="Refresh token secret key (if None, uses SECRET_KEY)"
    )
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # ========== LOGGING SETTINGS ==========
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[Path] = None
    
    # ========== EMAIL SETTINGS (NO HARDCODED DEFAULTS) ==========
    # ⚠️ ALL MUST BE SET IN .env FILE
    EMAIL_HOST: str = Field(
        default="",
        description="SMTP server host (e.g., smtp.gmail.com, mail.example.com)"
    )
    EMAIL_PORT: int = Field(
        default=0,
        ge=1,
        le=65535,
        description="SMTP server port (25, 465, 587)"
    )
    EMAIL_USER: str = Field(
        default="",
        description="SMTP username/email address"
    )
    EMAIL_PASSWORD: SecretStr = Field(
        default="",
        description="SMTP password (MUST be in .env, never in code!)"
    )
    EMAIL_REJECT_UNAUTH: bool = Field(
        default=False,
        description="Reject unauthenticated emails"
    )
    EMAIL_USE_TLS: bool = Field(
        default=False,
        description="Use TLS for SMTP (typically port 587)"
    )
    EMAIL_USE_SSL: bool = Field(
        default=False,
        description="Use SSL for SMTP (typically port 465)"
    )
    EMAIL_FROM: str = Field(
        default="",
        description="Default from email address"
    )
    EMAIL_FROM_NAME: str = Field(
        default="Action Tracker",
        description="Default from name in email header"
    )
    EMAIL_TIMEOUT: int = Field(
        default=30,
        ge=5,
        le=300,
        description="Email sending timeout in seconds"
    )
    
    # ========== EMAIL VERIFICATION SETTINGS ==========
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = Field(
        default=24,
        ge=1,
        le=72,
        description="Email verification token expiration in hours"
    )
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = Field(
        default=24,
        ge=1,
        le=72,
        description="Password reset token expiration in hours"
    )
    
    # ========== FRONTEND SETTINGS ==========
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Frontend application URL"
    )
    FRONTEND_DIST_PATH: str = Field(
        default="/app/static",
        description="Frontend dist path (Docker: /app/static, Local: absolute path)"
    )
    BASE_URL: str = Field(
        default="http://127.0.0.1:8000",
        description="Base URL for API"
    )
    
    # ========== REDIS SETTINGS ==========
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_MAX_CONNECTIONS: int = 20
    
    # ========== ORGANIZATION SETTINGS ==========
    ORGANIZATION_NAME: str = Field(
        default="The Electoral Commission Uganda",
        description="Organization name"
    )
    SUPPORT_EMAIL: str = Field(
        default="",
        description="Support email address"
    )
    
    # ========== LOGO SETTINGS ==========
    LOGO_URL: Optional[str] = Field(
        default=None,
        description="Logo URL (can be absolute URL or relative path)"
    )
    FOOTER_LOGO_URL: Optional[str] = Field(
        default=None,
        description="Footer logo URL"
    )
    LOGO_ALT_TEXT: str = Field(
        default="Logo",
        description="Logo alt text"
    )
    LOGO_USE_BASE64: bool = Field(
        default=True,
        description="Use base64 encoding for logos"
    )
    LOGO_LOCAL_PATH: str = Field(
        default="/static/logo.jpg",
        description="Local path to logo file"
    )
    
    # ========== DOCKER SETTINGS ==========
    IN_DOCKER: bool = Field(
        default=False,
        description="Set to true when running in Docker"
    )
    
    # ========== HEALTH CHECK SETTINGS ==========
    HEALTH_CHECK_ENABLED: bool = Field(
        default=True,
        description="Enable health check endpoint"
    )
    
    # ========== MINIO SETTINGS ==========
    MINIO_ENDPOINT: str = Field(
        default="localhost:9000",
        description="MinIO endpoint"
    )
    MINIO_ACCESS_KEY: str = Field(
        default="minioadmin",
        description="MinIO access key"
    )
    MINIO_SECRET_KEY: str = Field(
        default="minioadmin",
        description="MinIO secret key"
    )
    MINIO_BUCKET_NAME: str = Field(
        default="meeting-documents",
        description="MinIO bucket name"
    )
    MINIO_SECURE: bool = Field(
        default=False,
        description="Use HTTPS for MinIO"
    )
    MINIO_API_CORS_ALLOW_ORIGIN: str = Field(
        default="http://localhost:3000",
        description="MinIO CORS allow origin"
    )
    
    # ========== ADMIN USER ==========
    ADMIN_USERNAME: str = Field(
        default="admin",
        description="Default admin username"
    )
    ADMIN_PASSWORD: str = Field(
        default="",
        description="Default admin password (should be in .env)"
    )
    
    # ========== ROOT PATH ==========
    ROOT_PATH: str = Field(
        default="",
        description="Root path for API"
    )
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        use_enum_values=True
    )
    
    # ========== VALIDATORS ==========
    
    @field_validator("EMAIL_PASSWORD", mode="before")
    @classmethod
    def validate_email_password(cls, v: Union[str, SecretStr]) -> SecretStr:
        """Validate and convert email password to SecretStr"""
        if isinstance(v, SecretStr):
            return v
        return SecretStr(v) if v else SecretStr("")
    
    @field_validator("REFRESH_TOKEN_SECRET_KEY", mode="before")
    @classmethod
    def validate_refresh_token_secret(cls, v: Optional[Union[str, SecretStr]]) -> Optional[SecretStr]:
        """Validate refresh token secret key"""
        if v is None:
            return None
        if isinstance(v, SecretStr):
            return v
        return SecretStr(v) if v else None
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        """Parse CORS origins from various formats"""
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.lower() == "*":
                return ["*"]
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    cleaned = v.replace("'", '"')
                    try:
                        parsed = json.loads(cleaned)
                        if isinstance(parsed, list):
                            return parsed
                    except json.JSONDecodeError:
                        pass
            return [item.strip() for item in v.split(",") if item.strip()]
        elif isinstance(v, list):
            return [str(item) for item in v]
        return []
    
    @field_validator("DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        """Validate database URL"""
        valid = [
            "postgresql://", "postgresql+asyncpg://", "postgres://",
            "mysql://", "mysql+asyncmy://", "mysql+pymysql://", "mysql+aiomysql://",
            "sqlite://", "sqlite+aiosqlite://"
        ]
        if not any(v.startswith(p) for p in valid):
            raise ValueError(f"Unsupported database URL. Must start with one of: {', '.join(valid[:5])}...")
        return v
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url_docker(cls, v: str, info: ValidationInfo) -> str:
        """Auto-adjust database URL for Docker"""
        if is_running_in_docker() and 'localhost' in v:
            v = v.replace('localhost', 'mysql')
            logger.info("Auto-converted DATABASE_URL for Docker")
        return v
    
    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def validate_redis_url(cls, v: str) -> str:
        """Auto-adjust Redis URL for Docker"""
        if v and is_running_in_docker() and ('localhost' in v or '127.0.0.1' in v):
            v = v.replace('localhost', 'redis').replace('127.0.0.1', 'redis')
            logger.warning(
                "⚠️ REDIS_URL pointed at localhost inside Docker - "
                f"auto-converted to '{v}'. Set REDIS_URL explicitly to silence this."
            )
        return v
    
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: Any, info: ValidationInfo) -> SecretStr:
        """Validate secret key"""
        if isinstance(v, SecretStr):
            key = v.get_secret_value()
        else:
            key = str(v) if v else ""
        
        if not key:
            raise ValueError("SECRET_KEY cannot be empty")
        
        if info.data.get("ENVIRONMENT") == "production" and len(key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters in production")
        
        return SecretStr(key)
    
    # ========== PROPERTIES ==========
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Get CORS origins for middleware"""
        if self.DEV_CORS_ALLOW_ALL:
            return ["*"]
        if self.BACKEND_CORS_ORIGINS == ["*"]:
            return ["*"]
        return self.BACKEND_CORS_ORIGINS
    
    @property
    def IS_PRODUCTION(self) -> bool:
        """Check if running in production"""
        return self.ENVIRONMENT == "production"
    
    @property
    def IS_DEVELOPMENT(self) -> bool:
        """Check if running in development"""
        return self.ENVIRONMENT == "development"
    
    @property
    def is_docker(self) -> bool:
        """Check if running in Docker"""
        return is_running_in_docker()
    
    def get_secret_key_value(self, key: Optional[SecretStr]) -> Optional[str]:
        """Helper to get string value from SecretStr"""
        if key is None:
            return None
        return key.get_secret_value()
    
    def model_post_init(self, __context):
        """Post-initialization setup"""
        logger.info(f"✅ Settings loaded: {self.ENVIRONMENT}")
        
        # Validate email configuration
        if not self.EMAIL_HOST or not self.EMAIL_USER or not self.EMAIL_FROM:
            logger.warning("⚠️ Email configuration incomplete - check .env file")
            logger.warning(f"   EMAIL_HOST: {'✓' if self.EMAIL_HOST else '✗'}")
            logger.warning(f"   EMAIL_USER: {'✓' if self.EMAIL_USER else '✗'}")
            logger.warning(f"   EMAIL_FROM: {'✓' if self.EMAIL_FROM else '✗'}")
        else:
            mode = "SSL" if self.EMAIL_USE_SSL else "STARTTLS" if self.EMAIL_USE_TLS else "Plain"
            logger.info(f"✅ Email configured: {self.EMAIL_HOST}:{self.EMAIL_PORT} ({mode})")
        
        if self.IS_PRODUCTION:
            if self.DEBUG:
                logger.warning("⚠️ DEBUG mode is enabled in production!")
            if self.CORS_ORIGINS == ["*"]:
                logger.warning("⚠️ CORS allows all origins in production!")
        
        if self.REFRESH_TOKEN_SECRET_KEY is None:
            logger.info("🔐 Using main SECRET_KEY for refresh tokens")
        else:
            logger.info("🔐 Using dedicated refresh token secret key")


# ========== CREATE SETTINGS INSTANCE ==========
try:
    settings = Settings()
except Exception as e:
    logger.error(f"❌ Failed to load settings: {e}")
    raise

# Log a warning if SECRET_KEY is too short
secret_key_value = settings.get_secret_key_value(settings.SECRET_KEY)
if secret_key_value and len(secret_key_value) < 32:
    logger.warning(f"⚠️ SECRET_KEY is only {len(secret_key_value)} characters long. For production, use at least 32 characters.")

__all__ = ["settings", "Environment"]