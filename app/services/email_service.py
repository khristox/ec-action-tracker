# app/services/email_service.py - FIXED for STARTTLS

import smtplib
import ssl
import socket
import asyncio
import time
import re
import logging
import jwt
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, TemplateNotFound
from dataclasses import dataclass, field
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings

logger = logging.getLogger(__name__)

# Set up Jinja2 template environment
template_dir = Path(__file__).parent.parent / "templates" / "email"
template_env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=True
)

@dataclass
class EmailConfig:
    """Email configuration dataclass with enhanced validation"""
    host: str
    port: int
    username: str
    password: str
    from_email: str
    from_name: str
    use_ssl: bool
    use_tls: bool
    timeout: int = 30
    is_configured: bool = False

    @classmethod
    def from_settings(cls) -> "EmailConfig":
        password = cls._extract_password()
        
        # Get settings with proper defaults for STARTTLS
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
        use_tls = getattr(settings, 'EMAIL_USE_TLS', True)
        
        # Validation: Can't have both SSL and TLS
        if use_ssl and use_tls:
            logger.warning("⚠️ Both EMAIL_USE_SSL and EMAIL_USE_TLS are True. Using SSL (higher priority).")
            use_tls = False
        
        config = cls(
            host=getattr(settings, 'EMAIL_HOST', None),
            port=int(getattr(settings, 'EMAIL_PORT', 587)),  # Default to 587 (STARTTLS)
            username=getattr(settings, 'EMAIL_USER', None),
            password=password,
            from_email=getattr(settings, 'EMAIL_FROM', None),
            from_name=getattr(settings, 'EMAIL_FROM_NAME', 'Action Tracker'),
            use_ssl=use_ssl,
            use_tls=use_tls,
            timeout=int(getattr(settings, 'EMAIL_TIMEOUT', 30)),
        )
        config.is_configured = config._validate()
        
        # Log the configuration mode
        if config.is_configured:
            if config.use_ssl:
                logger.info(f"📧 Email mode: SSL on port {config.port}")
            elif config.use_tls:
                logger.info(f"📧 Email mode: STARTTLS on port {config.port}")
            else:
                logger.warning(f"📧 Email mode: Unencrypted on port {config.port}")
        
        return config

    @staticmethod
    def _extract_password() -> str:
        password_raw = getattr(settings, 'EMAIL_PASSWORD', None)
        if not password_raw: 
            return ''
        if hasattr(password_raw, 'get_secret_value'):
            return password_raw.get_secret_value()
        return str(password_raw)

    def _validate(self) -> bool:
        required = [self.host, self.username, self.password, self.from_email]
        if not all(required):
            logger.warning(f"Missing email config: host={self.host}, user={bool(self.username)}, "
                          f"password={bool(self.password)}, from={self.from_email}")
            return False
        if not (1 <= self.port <= 65535):
            logger.warning(f"Invalid EMAIL_PORT: {self.port}")
            return False
        return True

class EmailService:
    def __init__(self):
        self.config = EmailConfig.from_settings()
        self._secret_key = self._get_secret_key()
        self._algorithm = getattr(settings, 'ALGORITHM', 'HS256')
        self._project_name = getattr(settings, 'PROJECT_NAME', 'Action Tracker')

        if self.config.is_configured:
            # Test connection asynchronously to avoid blocking startup
            asyncio.create_task(self._test_and_log_connection_async())

    @property
    def frontend_url(self) -> str:
        return getattr(settings, 'FRONTEND_URL', 'http://localhost:8001')

    def _get_secret_key(self) -> str:
        if hasattr(settings.SECRET_KEY, 'get_secret_value'):
            return settings.SECRET_KEY.get_secret_value()
        return str(settings.SECRET_KEY)

    def _create_smtp_connection(self):
        """
        Create SMTP connection based on configuration.
        Supports:
        - SSL: Direct SSL connection (port 465)
        - STARTTLS: Plain connection then upgrade (port 587)
        - Plain: No encryption (port 25 - not recommended)
        """
        logger.debug(f"🔌 Connecting to {self.config.host}:{self.config.port} "
                    f"(SSL={self.config.use_ssl}, TLS={self.config.use_tls})")
        
        try:
            # Case 1: SSL (direct SSL connection)
            if self.config.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(
                    self.config.host, 
                    self.config.port, 
                    context=context, 
                    timeout=self.config.timeout
                )
                logger.debug("✅ SSL connection established")
            
            # Case 2: STARTTLS or Plain
            else:
                server = smtplib.SMTP(
                    self.config.host, 
                    self.config.port, 
                    timeout=self.config.timeout
                )
                logger.debug("✅ Plain SMTP connection established")
                
                # Upgrade to TLS if requested
                if self.config.use_tls:
                    server.ehlo()  # Required for STARTTLS
                    server.starttls()
                    server.ehlo()  # Re-identify after TLS
                    logger.debug("✅ STARTTLS upgrade successful")
            
            return server
            
        except (smtplib.SMTPConnectError, smtplib.SMTPAuthenticationError,
                socket.timeout, ConnectionRefusedError) as e:
            logger.error(f"❌ SMTP connection failed: {e}")
            raise
        except Exception as e:
            logger.error(f"❌ Unexpected error creating SMTP connection: {e}")
            raise

    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        default_context = {
            "year": str(datetime.now().year),
            "project_name": self._project_name,
            "support_email": self.config.from_email,
            "frontend_url": self.frontend_url,
        }
        full_context = {**default_context, **(context or {})}
        try:
            template = template_env.get_template(template_name)
            return template.render(**full_context)
        except TemplateNotFound:
            logger.error(f"❌ Template not found: {template_name}")
            # Return a simple fallback HTML
            return f"""
            <html>
            <body>
                <h1>{self._project_name}</h1>
                <p>Hello {context.get('username', 'User')},</p>
                <p>Please verify your email by clicking: <a href="{context.get('verification_url', '#')}">here</a></p>
            </body>
            </html>
            """
        except Exception as e:
            logger.error(f"❌ Template error ({template_name}): {e}")
            raise

    # --- Token Management ---

    def generate_verification_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for email verification"""
        expire = datetime.utcnow() + timedelta(hours=getattr(settings, 'EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS', 24))
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "email_verification",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"🔐 Generated verification token for {email}")
        return token

    def verify_token(self, token: str, token_type: str) -> Optional[Dict]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
            if payload.get("type") != token_type:
                logger.warning(f"Invalid token type: expected {token_type}, got {payload.get('type')}")
                return None
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired {token_type} token")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid {token_type} token: {e}")
            return None

    # --- Email Sending Logic ---

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((smtplib.SMTPServerDisconnected, socket.timeout, ConnectionError))
    )
    def _send_email_sync(self, to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
        """Blocking SMTP send with retry logic"""
        if not self.config.is_configured:
            return False, "Email service not configured"

        server = None
        try:
            # Create multipart message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.config.from_name} <{self.config.from_email}>"
            message["To"] = to_email
            message["Date"] = formatdate(localtime=True)
            message["Message-ID"] = make_msgid(domain=self.config.host.split('.')[0] if self.config.host else 'localhost')

            # Create plain text version by stripping HTML
            plain_text = re.sub(r'<[^>]+>', '', html_content)
            plain_text = re.sub(r'\n\s*\n', '\n\n', plain_text).strip()
            
            # Attach both versions
            text_part = MIMEText(plain_text, "plain", "utf-8")
            html_part = MIMEText(html_content, "html", "utf-8")
            
            message.attach(text_part)
            message.attach(html_part)

            # Create connection and send
            server = self._create_smtp_connection()
            
            # Login if credentials provided
            if self.config.username and self.config.password:
                server.login(self.config.username, self.config.password)
                logger.debug("✅ SMTP authentication successful")
            
            # Send the email
            server.send_message(message)
            logger.info(f"✅ Email sent successfully to {to_email}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"Authentication failed: {e}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg
        except smtplib.SMTPRecipientsRefused as e:
            error_msg = f"Recipient refused: {e}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg
        except smtplib.SMTPServerDisconnected as e:
            error_msg = f"Server disconnected: {e}"
            logger.error(f"❌ {error_msg}")
            raise  # Let retry handler deal with this
        except Exception as e:
            error_msg = f"Failed to send: {e}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg
        finally:
            if server:
                try:
                    server.quit()
                except:
                    pass

    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email asynchronously"""
        if not to_email:
            logger.warning("No recipient email provided")
            return False

        if not self.config.is_configured:
            logger.warning("Email service not configured, skipping email send")
            return False

        try:
            loop = asyncio.get_running_loop()
            success, error_msg = await loop.run_in_executor(
                None, 
                self._send_email_sync, 
                to_email, 
                subject, 
                html_content
            )
            
            if not success:
                logger.error(f"Email send failed: {error_msg}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Unexpected error sending email to {to_email}: {e}")
            return False

    async def send_verification_email(self, to_email: str, token: str, username: str) -> Dict[str, Any]:
        """Send verification email to user"""
        start_time = time.time()
        
        if not all([to_email, token, username]):
            return {"success": False, "message": "Missing required parameters"}
        
        if not self.config.is_configured:
            return {"success": False, "message": "Email service not configured"}

        try:
            verification_url = f"{self.frontend_url}/verify-email?token={token}"
            
            logger.info(f"📧 Sending verification email to: {to_email}")
            logger.debug(f"   Verification URL: {verification_url}")
            
            # Render HTML template
            html_content = self._render_template("verification.html", {
                "username": username,
                "verification_url": verification_url,
                "expires_in_hours": getattr(settings, 'EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS', 24)
            })
            
            subject = f"Verify Your Email Address - {self._project_name}"
            
            # Send email
            success = await self.send_email(to_email, subject, html_content)

            elapsed = time.time() - start_time
            
            if success:
                logger.info(f"✅ Verification email sent to {to_email} in {elapsed:.2f}s")
                return {"success": True, "message": "Verification email sent"}
            else:
                logger.error(f"❌ Failed to send verification email to {to_email}")
                return {"success": False, "message": "Failed to send verification email"}

        except Exception as e:
            logger.error(f"❌ Failed to send verification email: {e}", exc_info=True)
            return {"success": False, "message": str(e)}

    async def send_welcome_email(self, to_email: str, username: str, first_name: Optional[str] = None) -> bool:
        """Send welcome email after verification"""
        if not to_email or not self.config.is_configured:
            return False
        
        try:
            html_content = self._render_template("welcome.html", {
                "username": first_name or username,
                "login_url": f"{self.frontend_url}/login"
            })
            
            subject = f"Welcome to {self._project_name}!"
            success = await self.send_email(to_email, subject, html_content)

            if success:
                logger.info(f"✅ Welcome email sent to {to_email}")
            return success

        except Exception as e:
            logger.error(f"❌ Failed to send welcome email: {e}")
            return False

    async def send_password_reset_email(self, to_email: str, token: str, username: str) -> bool:
        """Send password reset email"""
        if not to_email or not self.config.is_configured:
            return False
        
        try:
            reset_url = f"{self.frontend_url}/reset-password?token={token}"
            
            html_content = self._render_template("password_reset.html", {
                "username": username,
                "reset_url": reset_url,
                "expires_in_hours": getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRE_HOURS', 1)
            })
            
            subject = f"Reset Your Password - {self._project_name}"
            success = await self.send_email(to_email, subject, html_content)

            if success:
                logger.info(f"✅ Password reset email sent to {to_email}")
            return success

        except Exception as e:
            logger.error(f"❌ Failed to send password reset email: {e}")
            return False

    async def _test_and_log_connection_async(self):
        """Test SMTP connection asynchronously"""
        try:
            loop = asyncio.get_running_loop()
            success, message = await loop.run_in_executor(None, self._test_connection_sync)
            if success:
                logger.info("🚀 Email Service: SMTP Connection & Auth Successful")
            else:
                logger.warning(f"⚠️ Email Service: Connection Test Failed: {message}")
        except Exception as e:
            logger.warning(f"⚠️ Email Service: Connection test error: {e}")

    def _test_connection_sync(self) -> Tuple[bool, str]:
        """Synchronous connection test"""
        server = None
        try:
            server = self._create_smtp_connection()
            
            if self.config.username and self.config.password:
                server.login(self.config.username, self.config.password)
            
            server.quit()
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)
        finally:
            if server:
                try:
                    server.quit()
                except:
                    pass

    def is_configured(self) -> bool:
        """Check if email service is configured"""
        return self.config.is_configured

    # Add this method to your EmailService class (add it after generate_verification_token)

    def generate_password_reset_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for password reset"""
        expire = datetime.utcnow() + timedelta(hours=getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRE_HOURS', 1))
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "password_reset",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"🔐 Generated password reset token for {email}")
        return token

# Create singleton instance
email_service = EmailService()