import smtplib
import ssl
import socket
import asyncio
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import jwt
import logging
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
from fastapi import BackgroundTasks
from dataclasses import dataclass, field
from functools import wraps
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from contextlib import asynccontextmanager

from app.core.config import settings

logger = logging.getLogger(__name__)

# Set up Jinja2 template environment
template_dir = Path(__file__).parent.parent / "templates" / "email"
template_env = Environment(loader=FileSystemLoader(template_dir))


def async_retry(func):
    """Decorator to add retry logic to async email sending"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                logger.warning(f"Email send attempt {attempt + 1} failed: {e}, retrying...")
                await asyncio.sleep(2 ** attempt)
    return wrapper


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
    connection_test_result: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_settings(cls) -> "EmailConfig":
        """Create EmailConfig from application settings"""
        password = cls._extract_password()
        config = cls(
            host=getattr(settings, 'EMAIL_HOST', None),
            port=getattr(settings, 'EMAIL_PORT', 465),
            username=getattr(settings, 'EMAIL_USER', None),
            password=password,
            from_email=getattr(settings, 'EMAIL_FROM', None),
            from_name=getattr(settings, 'EMAIL_FROM_NAME', 'SWAHILLI'),
            use_ssl=getattr(settings, 'EMAIL_USE_SSL', True),
            use_tls=getattr(settings, 'EMAIL_USE_TLS', False),
            timeout=getattr(settings, 'EMAIL_TIMEOUT', 30),
        )
        config.is_configured = config._validate()
        return config
    
    @staticmethod
    def _extract_password() -> str:
        """Extract password from settings (handles SecretStr)"""
        password_raw = getattr(settings, 'EMAIL_PASSWORD', None)
        if not password_raw:
            return ''
        try:
            if hasattr(password_raw, 'get_secret_value'):
                return password_raw.get_secret_value()
            return str(password_raw)
        except Exception:
            return ''
    
    def _validate(self) -> bool:
        """Validate email configuration with detailed error reporting"""
        required_fields = {
            'EMAIL_HOST': self.host,
            'EMAIL_USER': self.username,
            'EMAIL_PASSWORD': self.password,
            'EMAIL_FROM': self.from_email,
        }
        
        missing = [field for field, value in required_fields.items() if not value]
        
        if missing:
            logger.warning(f"📧 Email service missing configuration: {', '.join(missing)}")
            return False
        
        if not (1 <= self.port <= 65535):
            logger.warning(f"📧 Invalid EMAIL_PORT: {self.port}")
            return False
        
        if '@' not in self.from_email or '.' not in self.from_email.split('@')[-1]:
            logger.warning(f"📧 Invalid EMAIL_FROM format: {self.from_email}")
            return False
        
        logger.info(f"📧 Email configuration validated successfully")
        return True


class EmailService:
    """Enhanced service for sending emails with improved reliability"""
    
    def __init__(self):
        self.config = EmailConfig.from_settings()
        self._secret_key = self._get_secret_key()
        self._algorithm = getattr(settings, 'ALGORITHM', 'HS256')
        self._backend_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8001')
        self._api_prefix = getattr(settings, 'API_V1_STR', '/api/v1')
        self._frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:8001/api/v1/auth')
        
        self._log_initialization()
        
        if self.config.is_configured:
            self._test_and_log_connection()
    
    def _get_secret_key(self) -> str:
        """Extract secret key as string from settings"""
        try:
            if hasattr(settings.SECRET_KEY, 'get_secret_value'):
                return settings.SECRET_KEY.get_secret_value()
            return str(settings.SECRET_KEY)
        except Exception as e:
            logger.error(f"❌ Failed to get secret key: {e}")
            raise ValueError("SECRET_KEY not properly configured")
    
    def _log_initialization(self):
        """Log email service initialization status"""
        logger.info("=" * 70)
        logger.info("📧 Email Service Initialization")
        logger.info("=" * 70)
        logger.info(f"   Host: {self.config.host}")
        logger.info(f"   Port: {self.config.port}")
        logger.info(f"   Username: {self.config.username}")
        logger.info(f"   Password: {'✓ Set' if self.config.password else '✗ Not set'}")
        logger.info(f"   From: {self.config.from_email}")
        logger.info(f"   Name: {self.config.from_name}")
        logger.info(f"   SSL: {self.config.use_ssl}")
        logger.info(f"   TLS: {self.config.use_tls}")
        logger.info(f"   Timeout: {self.config.timeout}s")
        logger.info(f"   Configured: {self.config.is_configured}")
        logger.info(f"   Frontend URL: {self._frontend_url}")
        logger.info("=" * 70)
    
    def _test_and_log_connection(self):
        """Test SMTP connection and log results"""
        try:
            success, diagnostics = self.test_connection()
            self.config.connection_test_result = diagnostics
            
            if success:
                logger.info("✅ Email service connection test PASSED")
            else:
                logger.warning("⚠️ Email service connection test FAILED")
                logger.warning(f"   Error: {diagnostics.get('error', 'Unknown error')}")
        except Exception as e:
            logger.warning(f"⚠️ Email service connection test failed: {e}")
    
    def _is_configured(self) -> bool:
        """Check if email service is configured"""
        return self.config.is_configured
    
    def resolve_hostname(self, hostname: str) -> Tuple[bool, list]:
        """Resolve hostname to IP addresses with timeout"""
        try:
            original_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(10)
            ips = socket.gethostbyname_ex(hostname)
            socket.setdefaulttimeout(original_timeout)
            logger.info(f"📡 DNS resolution for {hostname}: {ips[2]}")
            return True, ips[2]
        except (socket.gaierror, socket.timeout) as e:
            logger.error(f"❌ DNS resolution failed for {hostname}: {e}")
            return False, []
        except Exception as e:
            logger.error(f"❌ Unexpected error resolving {hostname}: {e}")
            return False, []
        finally:
            socket.setdefaulttimeout(None)
    
    def test_connection(self) -> Tuple[bool, dict]:
        """Test SMTP connection and return detailed diagnostics"""
        diagnostics = {
            "host": self.config.host,
            "port": self.config.port,
            "use_ssl": self.config.use_ssl,
            "use_tls": self.config.use_tls,
            "timestamp": datetime.now().isoformat(),
            "resolved_ips": [],
            "tcp_connection_success": False,
            "smtp_connection_success": False,
            "auth_success": False,
            "error": None,
            "server_banner": None
        }
        
        # DNS Resolution
        success, ips = self.resolve_hostname(self.config.host)
        if not success:
            diagnostics["error"] = f"DNS resolution failed for {self.config.host}"
            return False, diagnostics
        
        diagnostics["resolved_ips"] = ips
        logger.info(f"✅ DNS resolution successful: {ips}")
        
        # TCP Connection Test
        for ip in ips[:3]:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(self.config.timeout)
                result = sock.connect_ex((ip, self.config.port))
                sock.close()
                
                if result == 0:
                    diagnostics["tcp_connection_success"] = True
                    logger.info(f"✅ TCP connection successful to {ip}:{self.config.port}")
                    break
            except Exception as e:
                logger.warning(f"⚠️ Error testing {ip}:{self.config.port}: {e}")
        
        if not diagnostics["tcp_connection_success"]:
            diagnostics["error"] = "No TCP connection could be established"
            return False, diagnostics
        
        # SMTP Connection Test
        try:
            server = self._create_smtp_connection()
            diagnostics["server_banner"] = server.ehlo()[1] if server.ehlo() else "Unknown"
            diagnostics["smtp_connection_success"] = True
            logger.info(f"✅ SMTP connection successful")
            
            # Authentication Test
            try:
                server.login(self.config.username, self.config.password)
                diagnostics["auth_success"] = True
                logger.info(f"✅ Authentication successful")
            except Exception as e:
                diagnostics["error"] = f"Authentication failed: {e}"
                logger.warning(f"⚠️ Authentication failed: {e}")
            
            server.quit()
        except Exception as e:
            diagnostics["error"] = f"SMTP connection failed: {e}"
            return False, diagnostics
        
        return diagnostics["smtp_connection_success"] and diagnostics["auth_success"], diagnostics
    
    def _create_smtp_connection(self):
        """Create SMTP connection based on settings"""
        if not self.config.is_configured:
            raise ValueError("Email service not configured properly")
        
        logger.info(f"📧 Connecting to SMTP server: {self.config.host}:{self.config.port}")
        
        try:
            if self.config.use_ssl:
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(
                    self.config.host, 
                    self.config.port, 
                    context=context,
                    timeout=self.config.timeout
                )
            else:
                server = smtplib.SMTP(self.config.host, self.config.port, timeout=self.config.timeout)
                if self.config.use_tls:
                    server.starttls()
            
            server.ehlo()
            return server
            
        except (smtplib.SMTPConnectError, smtplib.SMTPAuthenticationError, 
                socket.timeout, ConnectionRefusedError) as e:
            logger.error(f"❌ SMTP connection failed: {e}")
            raise
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((smtplib.SMTPServerDisconnected, socket.timeout))
    )
    def _send_email_sync(self, to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
        """Send email using SMTP with retry logic"""
        if not self.config.is_configured:
            return False, "Email service not configured"
        
        if not to_email or not isinstance(to_email, str):
            return False, f"Invalid recipient email: {to_email}"
        
        server = None
        try:
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.config.from_name} <{self.config.from_email}>"
            message["To"] = to_email
            message.attach(MIMEText(html_content, "html"))
            
            server = self._create_smtp_connection()
            server.login(self.config.username, self.config.password)
            server.send_message(message)
            
            logger.info(f"✅ Email sent successfully to {to_email}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"Authentication failed: {e}"
            logger.error(f"❌ {error_msg}")
            return False, error_msg
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
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email (synchronous wrapper)"""
        success, _ = self._send_email_sync(to_email, subject, html_content)
        return success
    
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render HTML template with context"""
        default_context = {
            "year": str(datetime.utcnow().year),
            "project_name": getattr(settings, 'PROJECT_NAME', 'SWAHILLI'),
            "support_email": self.config.from_email,
        }
        context = {**default_context, **(context or {})}
        
        try:
            template = template_env.get_template(template_name)
            return template.render(**context)
        except TemplateNotFound:
            logger.warning(f"Template not found: {template_name}, using fallback")
            return self._get_fallback_html(template_name, context)
        except Exception as e:
            logger.error(f"Failed to render template: {e}")
            return self._get_fallback_html(template_name, context)
    
    def _get_fallback_html(self, template_name: str, context: Dict[str, Any]) -> str:
        """Get fallback HTML when template is not found"""
        if "verification" in template_name:
            return self._get_verification_fallback(context)
        elif "welcome" in template_name:
            return self._get_welcome_fallback(context)
        elif "password_reset" in template_name:
            return self._get_password_reset_fallback(context)
        else:
            return self._get_default_fallback(context)
    
    def _get_verification_fallback(self, context: Dict[str, Any]) -> str:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Verify Your Email</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify Your Email Address</h2>
            <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
            <p>Please verify your email by clicking: <a href="{context.get('verification_url', '#')}">Verify Email</a></p>
            <p>This link expires in <strong>{context.get('expires_in_hours', '24')} hours</strong>.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">&copy; {context.get('year')} {context.get('project_name')}</p>
        </body>
        </html>
        """
    
    def _get_welcome_fallback(self, context: Dict[str, Any]) -> str:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Welcome</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Welcome to {context.get('project_name')}!</h2>
            <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
            <p>Your email has been verified. <a href="{context.get('login_url', '#')}">Login now</a></p>
        </body>
        </html>
        """
    
    def _get_password_reset_fallback(self, context: Dict[str, Any]) -> str:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Password Reset</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Password Reset Request</h2>
            <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
            <p>Click to reset: <a href="{context.get('reset_url', '#')}">Reset Password</a></p>
            <p>Expires in <strong>{context.get('expires_in_hours', '24')} hours</strong>.</p>
        </body>
        </html>
        """
    
    def _get_default_fallback(self, context: Dict[str, Any]) -> str:
        return f"<html><body><p>{context.get('message', 'Email from ' + context.get('project_name', 'System'))}</p></body></html>"
    
    # ==================== TOKEN METHODS ====================
    
    def generate_verification_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for email verification"""
        if not user_id or not email:
            raise ValueError("user_id and email are required")
        
        expire = datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS)
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "email_verification",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"🔐 Generated verification token for {email} (expires: {expire})")
        return token
    
    def generate_password_reset_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for password reset"""
        if not user_id or not email:
            raise ValueError("user_id and email are required")
        
        expire = datetime.utcnow() + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS)
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "password_reset",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"🔐 Generated password reset token for {email} (expires: {expire})")
        return token
    
    def verify_token(self, token: str, token_type: str) -> Optional[Dict]:
        """Verify JWT token with detailed logging"""
        if not token:
            return None
        
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
            
            if payload.get("type") != token_type:
                logger.warning(f"Invalid token type. Expected {token_type}")
                return None
            
            logger.info(f"✅ Token verified successfully")
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired {token_type} token")
            return None
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid {token_type} token: {e}")
            return None
    
    # ==================== EMAIL SENDING METHODS ====================
    
    async def send_verification_email(
        self,
        to_email: str,
        token: str,
        username: str
    ) -> Dict[str, Any]:
        """Send verification email (for background tasks)"""
        start_time = time.time()
        
        logger.info(f"📧 Sending verification email to: {to_email}")
        
        if not all([to_email, token]):
            return {"success": False, "message": "Missing required parameters"}
        
        if not self._is_configured():
            return {"success": False, "message": "Email service not configured"}
        
        try:
            verification_url = f"{self._frontend_url}/verify-email?token={token}"
            context = {
                "username": username or "User",
                "verification_url": verification_url,
                "expires_in_hours": str(settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
            }
            
            html_content = self._render_template("verification.html", context)
            success = self._send_email(
                to_email,
                f"Verify Your Email Address - {settings.PROJECT_NAME}",
                html_content
            )
            
            elapsed = time.time() - start_time
            if success:
                logger.info(f"✅ Verification email sent to {to_email} in {elapsed:.2f}s")
                return {"success": True, "message": "Verification email sent"}
            else:
                return {"success": False, "message": "Failed to send verification email"}
                
        except Exception as e:
            logger.error(f"❌ Failed to send: {e}")
            return {"success": False, "message": str(e)}
    
    async def send_welcome_email(
        self,
        to_email: str,
        username: str,
        background_tasks: BackgroundTasks
    ) -> bool:
        """Send welcome email after verification"""
        if not to_email or not self._is_configured():
            return False
        
        try:
            context = {
                "username": username or "User",
                "login_url": f"{self._frontend_url}/login",
            }
            
            html_content = self._render_template("welcome.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Welcome to {settings.PROJECT_NAME}!",
                html_content
            )
            
            logger.info(f"✅ Welcome email queued for {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
            return False
    
    async def send_password_reset_email(
        self,
        to_email: str,
        token: str,
        username: str,
        background_tasks: BackgroundTasks
    ) -> bool:
        """Send password reset email"""
        if not to_email or not self._is_configured():
            return False
        
        try:
            reset_url = f"{self._frontend_url}/reset-password?token={token}"
            context = {
                "username": username or "User",
                "reset_url": reset_url,
                "expires_in_hours": str(settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS),
            }
            
            html_content = self._render_template("password_reset.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Reset Your Password - {settings.PROJECT_NAME}",
                html_content
            )
            
            logger.info(f"✅ Password reset email queued for {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            return False
    
    async def send_password_reset_confirmation_email(
        self,
        to_email: str,
        username: str,
        background_tasks: BackgroundTasks
    ) -> bool:
        """Send confirmation email after password reset"""
        if not to_email or not self._is_configured():
            return False
        
        try:
            context = {
                "username": username or "User",
                "login_url": f"{self._frontend_url}/login",
            }
            
            html_content = self._render_template("password_reset_confirmation.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Password Reset Confirmation - {settings.PROJECT_NAME}",
                html_content
            )
            
            logger.info(f"✅ Password reset confirmation queued for {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send confirmation: {e}")
            return False


# Create singleton instance
email_service = EmailService()