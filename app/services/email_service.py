# app/services/email_service.py - Complete updated file

import asyncio
import logging
import smtplib
import socket
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
import jwt
from tenacity import retry, stop_after_attempt, wait_exponential
from app.core.config import settings
from jinja2 import Environment, FileSystemLoader
from pathlib import Path

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def get_secret_key_string() -> str:
    """Get SECRET_KEY as a string."""
    secret = settings.SECRET_KEY
    if hasattr(secret, 'get_secret_value'):
        return secret.get_secret_value()
    return str(secret)


def get_email_password_string() -> str:
    """Get EMAIL_PASSWORD as a string."""
    password = settings.EMAIL_PASSWORD
    if not password:
        return ""
    if hasattr(password, 'get_secret_value'):
        return password.get_secret_value()
    return str(password)


class EmailConfig:
    """Email configuration from environment variables"""
    
    def __init__(self):
        # Read from settings
        self.host = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.username = settings.EMAIL_USER
        self.password = get_email_password_string()
        self.from_email = settings.EMAIL_FROM
        self.from_name = settings.EMAIL_FROM_NAME
        self.use_tls = settings.EMAIL_USE_TLS
        self.use_ssl = settings.EMAIL_USE_SSL
        self.timeout = settings.EMAIL_TIMEOUT
        
        # Log the configuration
        logger.info("=" * 60)
        logger.info("📧 EMAIL CONFIGURATION LOADED:")
        logger.info(f"   Host: {self.host}")
        logger.info(f"   Port: {self.port}")
        logger.info(f"   User: {self.username}")
        logger.info(f"   Use SSL: {self.use_ssl}")
        logger.info(f"   Use TLS: {self.use_tls}")
        logger.info(f"   Timeout: {self.timeout}s")
        logger.info("=" * 60)
        
        self.is_configured = self._validate()
    
    def _validate(self) -> bool:
        """Validate email configuration"""
        required_fields = [
            (self.host, 'EMAIL_HOST'),
            (self.port, 'EMAIL_PORT'),
            (self.username, 'EMAIL_USER'),
            (self.password, 'EMAIL_PASSWORD'),
            (self.from_email, 'EMAIL_FROM'),
        ]
        
        for value, name in required_fields:
            if not value:
                logger.error(f"❌ Missing required email configuration: {name}")
                return False
        
        return True


class EmailService:
    """Email service with async support and automatic retry logic"""
    
    def __init__(self):
        self.config = EmailConfig()
        
        # Setup Jinja2 for templates
        templates_path = Path(__file__).parent.parent / "templates" / "email"
        if templates_path.exists():
            self.jinja_env = Environment(loader=FileSystemLoader(templates_path))
            logger.info(f"✅ Email templates loaded from: {templates_path}")
        else:
            self.jinja_env = None
            logger.warning(f"⚠️ Email templates directory not found: {templates_path}")
    
    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        return self.config.is_configured
    
    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render email template with context"""
        if not self.jinja_env:
            logger.warning(f"Template environment not configured, using fallback HTML")
            return ""
        
        try:
            template = self.jinja_env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            logger.error(f"Template rendering error for {template_name}: {e}")
            return ""
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    def _send_email_sync(self, to_email: str, subject: str, html_content: str) -> tuple[bool, str]:
        """
        Send email via SMTP with automatic retry on timeout.
        Returns: (success: bool, message: str)
        """
        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = f"{self.config.from_name} <{self.config.from_email}>"
            message['To'] = to_email
            message.attach(MIMEText(html_content, 'html'))
            
            # Add anti-spam headers
            message['List-Unsubscribe'] = f"<mailto:{self.config.from_email}?subject=unsubscribe>"
            message['Auto-Submitted'] = 'auto-generated'
            message['X-Priority'] = '3'
            message['X-Mailer'] = 'Action Tracker API'
            
            # Log connection attempt
            mode = "SSL" if self.config.use_ssl else "STARTTLS" if self.config.use_tls else "Plain"
            logger.info(f"📧 Connecting to SMTP: {self.config.host}:{self.config.port} ({mode})")
            
            # Establish connection based on configuration
            if self.config.use_ssl:
                # SSL connection (port 465)
                server = smtplib.SMTP_SSL(
                    self.config.host,
                    self.config.port,
                    timeout=self.config.timeout
                )
                logger.debug("✅ Connected via SSL")
            else:
                # Plain connection (port 25 or 587)
                server = smtplib.SMTP(
                    self.config.host,
                    self.config.port,
                    timeout=self.config.timeout
                )
                logger.debug("✅ Connected via SMTP")
                
                # Upgrade to TLS if configured (for port 587)
                if self.config.use_tls:
                    try:
                        # Try with timeout parameter (Python 3.9+)
                        server.starttls(timeout=self.config.timeout)
                        logger.debug("✅ Upgraded to TLS with timeout")
                    except TypeError:
                        # Fallback for older Python versions
                        server.starttls()
                        logger.debug("✅ Upgraded to TLS (without timeout parameter)")
                    except Exception as e:
                        logger.error(f"❌ TLS upgrade failed: {e}")
                        raise
            
            # Login with credentials
            logger.debug(f"🔐 Authenticating as {self.config.username}")
            server.login(self.config.username, self.config.password)
            logger.debug("✅ Authentication successful")
            
            # Send email
            server.sendmail(
                self.config.from_email,
                to_email,
                message.as_string()
            )
            server.quit()
            
            logger.info(f"✅ Email sent successfully to {to_email}")
            return True, "Email sent successfully"
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ SMTP authentication failed: {e}")
            logger.error(f"   Username: {self.config.username}")
            logger.error(f"   Password length: {len(self.config.password) if self.config.password else 0}")
            logger.error(f"   Please check EMAIL_USER and EMAIL_PASSWORD in .env")
            return False, f"SMTP authentication failed: {str(e)}"
            
        except socket.timeout as e:
            logger.error(f"❌ SMTP connection timeout ({self.config.timeout}s): {e}")
            logger.error(f"   Host: {self.config.host}")
            logger.error(f"   Port: {self.config.port}")
            logger.error(f"   Check if the server is reachable and firewall allows the connection")
            raise  # Tenacity will retry
            
        except smtplib.SMTPException as e:
            logger.error(f"❌ SMTP error: {e}")
            return False, f"SMTP error: {str(e)}"
            
        except Exception as e:
            logger.error(f"❌ Email send error: {str(e)}", exc_info=True)
            raise  # Tenacity will retry
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str
    ) -> Dict[str, Any]:
        """Send any email asynchronously"""
        if not self.config.is_configured:
            logger.error("❌ Email service not configured - cannot send email")
            return {"success": False, "message": "Email service not configured"}
        
        try:
            loop = asyncio.get_event_loop()
            success, message = await loop.run_in_executor(
                None,
                self._send_email_sync,
                to_email,
                subject,
                html_content
            )
            
            return {"success": success, "message": message}
            
        except Exception as e:
            logger.error(f"❌ Email send error: {str(e)}", exc_info=True)
            return {"success": False, "message": str(e)}
    
    async def send_verification_email(
        self,
        to_email: str,
        token: str,
        username: str = "User"
    ) -> Dict[str, Any]:
        """Send verification email asynchronously"""
        if not self.config.is_configured:
            logger.error("❌ Email service not configured - cannot send verification email")
            return {"success": False, "message": "Email service not configured"}
        
        try:
            # ✅ Fix: Build URL safely without double slashes
            base_url = str(settings.API_BASE_URL).rstrip('/')
            verification_url = f"{base_url}/api/v1/auth/verify-email?token={token}"
            
            # Try to use template, fallback to simple HTML
            html_content = self.render_template("verification.html", {
                "project_name": settings.PROJECT_NAME,
                "project_tagline": settings.PROJECT_TAGLINE,
                "username": username,
                "verification_url": verification_url,  # ✅ Using the fixed URL
                "expires_in_hours": settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS,
                "support_email": settings.SUPPORT_EMAIL,
                "year": datetime.now().year,
                "organization_name": settings.ORGANIZATION_NAME,
            })
            
            if not html_content:
                # Fallback simple template with fixed URL
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                        <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; text-align: center;">Welcome to {settings.PROJECT_NAME}!</h2>
                            <p style="color: #666; font-size: 14px;">Hi {username},</p>
                            <p style="color: #666; font-size: 14px;">Please click the button below to verify your email address:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{verification_url}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Verify Email Address
                                </a>
                            </div>
                            <p style="color: #999; font-size: 12px; text-align: center;">This link expires in {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS} hours.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="color: #999; font-size: 12px; text-align: center;">Questions? Contact us at <a href="mailto:{settings.SUPPORT_EMAIL}">{settings.SUPPORT_EMAIL}</a></p>
                        </div>
                    </body>
                </html>
                """
            
            return await self.send_email(to_email, "Verify Your Email Address", html_content)
            
        except Exception as e:
            logger.error(f"❌ Verification email error: {str(e)}", exc_info=True)
            return {"success": False, "message": str(e)}
        
    async def send_welcome_email(
        self,
        to_email: str,
        username: str = "User",
        first_name: str = None
    ) -> bool:
        """Send welcome email asynchronously"""
        if not self.config.is_configured:
            logger.error("❌ Email service not configured - cannot send welcome email")
            return False
        
        try:
            html_content = self.render_template("welcome.html", {
                "project_name": settings.PROJECT_NAME,
                "project_tagline": settings.PROJECT_TAGLINE,
                "username": username,
                "first_name": first_name or username,
                "login_url": f"{settings.FRONTEND_URL}/login",
                "support_email": settings.SUPPORT_EMAIL,
                "year": datetime.now().year,
                "organization_name": settings.ORGANIZATION_NAME,
            })
            
            if not html_content:
                # Fallback simple template
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                        <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; text-align: center;">Welcome, {first_name or username}!</h2>
                            <p style="color: #666; font-size: 14px;">Your email has been verified successfully!</p>
                            <p style="color: #666; font-size: 14px;">You can now log in and start using {settings.PROJECT_NAME}.</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{settings.FRONTEND_URL}/login" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Login Now
                                </a>
                            </div>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="color: #999; font-size: 12px; text-align: center;">Questions? Contact us at <a href="mailto:{settings.SUPPORT_EMAIL}">{settings.SUPPORT_EMAIL}</a></p>
                        </div>
                    </body>
                </html>
                """
            
            result = await self.send_email(to_email, "Welcome!", html_content)
            return result.get("success", False)
            
        except Exception as e:
            logger.error(f"❌ Welcome email error: {str(e)}", exc_info=True)
            return False
    
    async def send_password_reset_email(
        self,
        to_email: str,
        token: str,
        username: str = "User"
    ) -> bool:
        """Send password reset email asynchronously"""
        if not self.config.is_configured:
            logger.error("❌ Email service not configured - cannot send password reset email")
            return False
        
        try:
            html_content = self.render_template("password_reset.html", {
                "project_name": settings.PROJECT_NAME,
                "project_tagline": settings.PROJECT_TAGLINE,
                "username": username,
                "reset_url": f"{settings.FRONTEND_URL}/reset-password?token={token}",
                "expires_in_hours": settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS,
                "support_email": settings.SUPPORT_EMAIL,
                "year": datetime.now().year,
                "organization_name": settings.ORGANIZATION_NAME,
            })
            
            if not html_content:
                # Fallback simple template
                html_content = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                        <div style="max-width: 500px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
                            <p style="color: #666; font-size: 14px;">Hi {username},</p>
                            <p style="color: #666; font-size: 14px;">Click the button below to reset your password:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="{settings.FRONTEND_URL}/reset-password?token={token}" style="display: inline-block; background-color: #ff9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                    Reset Password
                                </a>
                            </div>
                            <p style="color: #999; font-size: 12px;">This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS} hour(s).</p>
                            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                            <p style="color: #999; font-size: 12px; text-align: center;">Questions? Contact us at <a href="mailto:{settings.SUPPORT_EMAIL}">{settings.SUPPORT_EMAIL}</a></p>
                        </div>
                    </body>
                </html>
                """
            
            result = await self.send_email(to_email, "Reset Your Password", html_content)
            return result.get("success", False)
            
        except Exception as e:
            logger.error(f"❌ Password reset email error: {str(e)}", exc_info=True)
            return False
    
    def generate_verification_token(self, user_id: str, email: str) -> str:
        """Generate email verification token"""
        try:
            secret_key = get_secret_key_string()
            
            payload = {
                "user_id": user_id,
                "email": email,
                "type": "email_verification",
                "exp": datetime.now(timezone.utc) + timedelta(
                    hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS
                )
            }
            token = jwt.encode(payload, secret_key, algorithm=settings.ALGORITHM)
            logger.info(f"✅ Verification token generated for {email}")
            return token
        except Exception as e:
            logger.error(f"❌ Token generation error: {str(e)}", exc_info=True)
            raise
    
    def generate_password_reset_token(self, user_id: str, email: str) -> str:
        """Generate password reset token"""
        try:
            secret_key = get_secret_key_string()
            
            payload = {
                "user_id": user_id,
                "email": email,
                "type": "password_reset",
                "exp": datetime.now(timezone.utc) + timedelta(
                    hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
                )
            }
            token = jwt.encode(payload, secret_key, algorithm=settings.ALGORITHM)
            logger.info(f"✅ Password reset token generated for {email}")
            return token
        except Exception as e:
            logger.error(f"❌ Token generation error: {str(e)}", exc_info=True)
            raise
    
    def verify_token(self, token: str, token_type: str) -> Optional[dict]:
        """Verify and decode token"""
        try:
            secret_key = get_secret_key_string()
            
            payload = jwt.decode(token, secret_key, algorithms=[settings.ALGORITHM])
            if payload.get("type") == token_type:
                logger.info(f"✅ Token verified: {token_type}")
                return payload
            logger.warning(f"❌ Token type mismatch: expected {token_type}, got {payload.get('type')}")
            return None
        except jwt.ExpiredSignatureError:
            logger.warning(f"❌ Token expired: {token_type}")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"❌ Invalid token: {str(e)}")
            return None


# ========== Initialize service ==========
email_service = EmailService()