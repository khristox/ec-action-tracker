# app/core/config.py

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List, Union, Any
from pydantic import AnyHttpUrl, Field, field_validator, ValidationInfo, SecretStr
from enum import Enum
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"

class Settings(BaseSettings):
    # App settings
    PROJECT_NAME: str = "RENT MANAGEMENT SYSTEM"
    PROJECT_TAGLINE: str = "Remt Management System"  # Optional tagline

    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False

    # Audit Log Settings
    LOG_API_ACCESS: bool = True
    LOG_ALL_API_ACCESS: bool = False
    AUDIT_LOG_RETENTION_DAYS: int = 90
    
    # CORS - Change to List[str] to allow "*"
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
    
    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_ECHO: bool = False
    SQL_ECHO: bool = False
    
    # Security
    SECRET_KEY: SecretStr
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Refresh Token - FIX: Use SecretStr for consistency
    REFRESH_TOKEN_SECRET_KEY: Optional[SecretStr] = Field(default=None, description="Refresh token secret key")
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[Path] = None
    
    # Email Settings
    EMAIL_HOST: str = Field(
        default="mail.eminence.co.ug",
        description="SMTP server host"
    )
    EMAIL_PORT: int = Field(
        default=465,
        ge=1,
        le=65535,
        description="SMTP server port"
    )
    EMAIL_USER: str = Field(
        default="egra@eminence.co.ug",
        description="SMTP username"
    )
    EMAIL_PASSWORD: SecretStr = Field(
        default="KxaXg3c*vyU$",
        description="SMTP password"
    )
    EMAIL_REJECT_UNAUTH: bool = Field(
        default=False,
        description="Reject unauthenticated emails"
    )
    EMAIL_USE_TLS: bool = Field(
        default=False,
        description="Use TLS for SMTP"
    )
    EMAIL_USE_SSL: bool = Field(
        default=True,
        description="Use SSL for SMTP (True for port 465)"
    )
    EMAIL_FROM: str = Field(
        default="egra@eminence.co.ug",
        description="Default from email address"
    )
    EMAIL_FROM_NAME: str = Field(
        default="RentMGS",
        description="Default from name"
    )
    
    # Frontend URLs
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Frontend application URL"
    )
    
    # Email verification
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
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        use_enum_values=True
    )
    
    @field_validator("EMAIL_PASSWORD", mode="before")
    @classmethod
    def validate_email_password(cls, v: Union[str, SecretStr]) -> SecretStr:
        """Validate email password"""
        if isinstance(v, SecretStr):
            return v
        return SecretStr(v)
    
    @field_validator("REFRESH_TOKEN_SECRET_KEY", mode="before")
    @classmethod
    def validate_refresh_token_secret(cls, v: Optional[Union[str, SecretStr]]) -> Optional[SecretStr]:
        """Validate refresh token secret key"""
        if v is None:
            return None
        if isinstance(v, SecretStr):
            return v
        return SecretStr(v)
    
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
                    # Try cleaning quotes
                    cleaned = v.replace("'", '"')
                    try:
                        parsed = json.loads(cleaned)
                        if isinstance(parsed, list):
                            return parsed
                    except json.JSONDecodeError:
                        pass
            # Comma-separated
            return [item.strip() for item in v.split(",") if item.strip()]
        elif isinstance(v, list):
            return [str(item) for item in v]
        return []
    
    @field_validator("DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        valid = [
            "postgresql://", "postgresql+asyncpg://", "postgres://",
            "mysql://", "mysql+asyncmy://", "mysql+pymysql://", "mysql+aiomysql://",
            "sqlite://", "sqlite+aiosqlite://"
        ]
        if not any(v.startswith(p) for p in valid):
            raise ValueError(f"Unsupported database URL. Must start with one of: {', '.join(valid[:5])}...")
        return v
    
    @field_validator("SECRET_KEY", mode="before")
    @classmethod
    def validate_secret_key(cls, v: Any, info: ValidationInfo) -> SecretStr:
        # Handle if it's already SecretStr
        if isinstance(v, SecretStr):
            key = v.get_secret_value()
        else:
            key = str(v) if v else ""
        
        if not key:
            raise ValueError("SECRET_KEY cannot be empty")
        
        # Check length for production
        if info.data.get("ENVIRONMENT") == "production" and len(key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters in production")
        
        return SecretStr(key)
    
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
        return self.ENVIRONMENT == "production"
    
    @property
    def IS_DEVELOPMENT(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    def get_secret_key_value(self, key: Optional[SecretStr]) -> Optional[str]:
        """Helper to get string value from SecretStr"""
        if key is None:
            return None
        return key.get_secret_value()
    
    def model_post_init(self, __context):
        logger.info(f"✅ Settings loaded: {self.ENVIRONMENT}")
        
        if self.IS_PRODUCTION:
            if self.DEBUG:
                logger.warning("⚠️ DEBUG mode is enabled in production!")
            if self.CORS_ORIGINS == ["*"]:
                logger.warning("⚠️ CORS allows all origins in production!")
        
        # Log refresh token configuration
        if self.REFRESH_TOKEN_SECRET_KEY is None:
            logger.info("🔐 Using main SECRET_KEY for refresh tokens")
        else:
            logger.info("🔐 Using dedicated refresh token secret key")


# Create settings instance
try:
    settings = Settings()
except Exception as e:
    logger.error(f"❌ Failed to load settings: {e}")
    raise


# Log a warning if SECRET_KEY is too short (without printing the key)
secret_key_value = settings.get_secret_key_value(settings.SECRET_KEY)
if secret_key_value and len(secret_key_value) < 32:
    import logging
    logging.warning(f"⚠️ SECRET_KEY is only {len(secret_key_value)} characters long. For production, use at least 32 characters.")


__all__ = ["settings", "Environment"]