import smtplib
import ssl
import socket
import asyncio
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any, Tuple
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


# app/services/email_service.py - Cleaned up version



logger = logging.getLogger(__name__)

# Setup Jinja2 template environment
template_env = Environment(
    loader=FileSystemLoader("app/templates/email"),
    autoescape=True
)


class EmailService:
    """Enhanced service for sending emails with improved reliability"""
    
    def __init__(self):
        self.config = EmailConfig.from_settings()
        self._secret_key = self._get_secret_key()
        self._algorithm = getattr(settings, 'ALGORITHM', 'HS256')
        self._backend_url = getattr(settings, 'BACKEND_URL', 'http://127.0.0.1:8001')
        self._api_prefix = getattr(settings, 'API_V1_STR', '/api/v1')
        self._frontend_url = getattr(settings, 'FRONTEND_URL', 'http://127.0.0.1:8001/api/v1/auth')
        
        self._log_initialization()
        
        if self.config.is_configured:
            self._test_and_log_connection()
    
    # ==================== INITIALIZATION & CONFIGURATION ====================
    
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
    
    # ==================== NETWORK & CONNECTION METHODS ====================
    
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
    
    # ==================== CORE EMAIL SENDING ====================
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((smtplib.SMTPServerDisconnected, socket.timeout))
    )
    def _send_email_sync(self, to_email: str, subject: str, html_content: str) -> Tuple[bool, str]:
        """Send email using SMTP with retry logic - ONLY accepts html_content"""
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
    
    # PUBLIC METHOD - Use this for sending emails
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Send email (synchronous wrapper)
        This is the MAIN method to call for sending emails
        """
        if not to_email:
            logger.warning("No recipient email provided")
            return False
        
        if not self._is_configured():
            logger.warning("Email service not configured, skipping email send")
            return False
        
        try:
            success, error = self._send_email_sync(to_email, subject, html_content)
            if success:
                logger.info(f"✅ Email sent to {to_email}")
            else:
                logger.error(f"❌ Failed to send email to {to_email}: {error}")
            return success
        except Exception as e:
            logger.error(f"❌ Unexpected error sending email to {to_email}: {e}")
            return False
    
    # Async version
    async def send_email_async(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            self.send_email, 
            to_email, 
            subject, 
            html_content
        )
    
    # Meeting notification method
    async def send_meeting_notification(
        self,
        to_email: str,
        meeting_title: str,
        meeting_date: str,
        meeting_time: str,
        participant_name: str,
        meeting_location: str = None,
        custom_message: str = None,
        tracker_url: str = None
    ) -> bool:
        """Send meeting notification email to participant"""
        if not to_email or not self._is_configured():
            return False
        
        try:
            subject = f"Meeting Notification: {meeting_title}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Meeting Notification</title>
                <style>
                    body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; }}
                    .meeting-details {{ background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }}
                    .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }}
                    .button {{ display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Meeting Notification</h2>
                </div>
                <div class="content">
                    <p>Dear <strong>{participant_name}</strong>,</p>
                    <p>This is a notification regarding the meeting: <strong>{meeting_title}</strong></p>
                    
                    <div class="meeting-details">
                        <h3>Meeting Details:</h3>
                        <ul>
                            <li><strong>Date:</strong> {meeting_date}</li>
                            <li><strong>Time:</strong> {meeting_time}</li>
                            <li><strong>Location:</strong> {meeting_location or 'To be confirmed'}</li>
                        </ul>
                    </div>
                    
                    {f"<p><strong>Message:</strong> {custom_message}</p>" if custom_message else ""}
                    
                    <p>Please check the action tracker for more details.</p>
                    
                    <p style="margin-top: 20px;">
                        <a href="{tracker_url or self._frontend_url}" class="button">View Action Tracker</a>
                    </p>
                </div>
                <div class="footer">
                    <p>&copy; {datetime.now().year} {getattr(settings, 'PROJECT_NAME', 'Action Tracker')}. All rights reserved.</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </body>
            </html>
            """
            
            return self.send_email(to_email, subject, html_content)
            
        except Exception as e:
            logger.error(f"❌ Failed to send meeting notification to {to_email}: {e}")
            return False
    
    # ==================== TEMPLATE RENDERING (Keep your existing methods) ====================
    
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render HTML template with context"""
        default_context = {
            "year": str(datetime.utcnow().year),
            "project_name": getattr(settings, 'PROJECT_NAME', 'Action Tracker'),
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
        """Send verification email"""
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
            success = self.send_email(
                to_email,
                f"Verify Your Email Address - {settings.PROJECT_NAME}",
                html_content
            )
            
            if success:
                logger.info(f"✅ Verification email sent to {to_email}")
                return {"success": True, "message": "Verification email sent"}
            else:
                return {"success": False, "message": "Failed to send verification email"}
                
        except Exception as e:
            logger.error(f"❌ Failed to send verification email: {e}")
            return {"success": False, "message": str(e)}


# Create singleton instance
email_service = EmailService()



# app/services/email_service.py (continued)

async def send_meeting_invitation_email(
    self,
    to_email: str,
    participant_name: str,
    meeting_details: Dict[str, Any],
    custom_message: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None
) -> bool:
    """
    Send meeting invitation email to a single participant using template
    """
    if not to_email or not self._is_configured():
        return False
    
    try:
        # Format meeting datetime
        meeting_date = meeting_details.get("date")
        if isinstance(meeting_date, datetime):
            meeting_datetime = meeting_date.strftime("%B %d, %Y at %I:%M %p")
        else:
            meeting_datetime = str(meeting_date) if meeting_date else "TBD"
        
        # Prepare context for template
        context = {
            "participant_name": participant_name,
            "meeting_title": meeting_details.get("title", "Meeting"),
            "meeting_datetime": meeting_datetime,
            "platform": meeting_details.get("platform", "physical"),
            "location": meeting_details.get("location"),
            "meeting_link": meeting_details.get("meeting_link"),
            "meeting_id": meeting_details.get("meeting_id"),
            "passcode": meeting_details.get("passcode"),
            "dial_in_numbers": meeting_details.get("dial_in_numbers", []),
            "custom_message": custom_message,
            "organizer_name": meeting_details.get("organizer_name", "Meeting Organizer"),
        }
        
        # Render template
        html_content = self._render_template("meeting_invitation.html", context)
        subject = f"Meeting Invitation: {meeting_details.get('title', 'Meeting')}"
        
        # Send email (sync or async)
        if background_tasks:
            background_tasks.add_task(self._send_email, to_email, subject, html_content)
            logger.info(f"✅ Meeting invitation queued for {to_email}")
        else:
            success = self._send_email(to_email, subject, html_content)
            logger.info(f"✅ Meeting invitation sent to {to_email}: {success}")
            return success
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send meeting invitation to {to_email}: {e}")
        return False


async def send_bulk_meeting_invitations(
    self,
    participants: List[Any],
    meeting_details: Dict[str, Any],
    custom_message: Optional[str] = None,
    background_tasks: Optional[BackgroundTasks] = None
) -> List[Dict[str, Any]]:
    """
    Send meeting invitations to multiple participants using templates
    
    Args:
        participants: List of participant objects (User model)
        meeting_details: Dictionary with meeting information
        custom_message: Optional custom message to include
        background_tasks: FastAPI BackgroundTasks for async sending
    
    Returns:
        List of results with status for each participant
    """
    results = []
    
    for participant in participants:
        try:
            # Skip if no email address
            if not participant.email:
                results.append({
                    "participant_id": str(participant.id),
                    "participant_email": None,
                    "type": "email",
                    "status": "skipped",
                    "message": "No email address available"
                })
                continue
            
            # Get participant name
            participant_name = (
                participant.full_name or 
                participant.username or 
                participant.email.split('@')[0] if participant.email else "Participant"
            )
            
            # Send invitation
            success = await self.send_meeting_invitation_email(
                to_email=participant.email,
                participant_name=participant_name,
                meeting_details=meeting_details,
                custom_message=custom_message,
                background_tasks=background_tasks
            )
            
            results.append({
                "participant_id": str(participant.id),
                "participant_email": participant.email,
                "participant_name": participant_name,
                "type": "email",
                "status": "sent" if success else "failed",
                "message": None if success else "Failed to send email"
            })
            
        except Exception as e:
            logger.error(f"❌ Failed to process participant {getattr(participant, 'id', 'unknown')}: {e}")
            results.append({
                "participant_id": str(getattr(participant, 'id', 'unknown')),
                "participant_email": getattr(participant, 'email', None),
                "type": "email",
                "status": "error",
                "message": str(e)
            })
    
    # Log summary
    sent_count = len([r for r in results if r.get("status") == "sent"])
    logger.info(f"📧 Bulk meeting invitations: {sent_count}/{len(participants)} sent successfully")
    
    return results


async def send_meeting_reminder_email(
    self,
    to_email: str,
    participant_name: str,
    meeting_details: Dict[str, Any],
    time_until: str,
    background_tasks: Optional[BackgroundTasks] = None
) -> bool:
    """
    Send meeting reminder email to a single participant
    """
    if not to_email or not self._is_configured():
        return False
    
    try:
        # Format meeting datetime
        meeting_date = meeting_details.get("date")
        if isinstance(meeting_date, datetime):
            meeting_datetime = meeting_date.strftime("%B %d, %Y at %I:%M %p")
        else:
            meeting_datetime = str(meeting_date) if meeting_date else "TBD"
        
        # Prepare context for template
        context = {
            "participant_name": participant_name,
            "meeting_title": meeting_details.get("title", "Meeting"),
            "meeting_datetime": meeting_datetime,
            "time_until": time_until,
            "platform": meeting_details.get("platform", "physical"),
            "location": meeting_details.get("location"),
            "meeting_link": meeting_details.get("meeting_link"),
            "meeting_id": meeting_details.get("meeting_id"),
            "passcode": meeting_details.get("passcode"),
        }
        
        # Render template
        html_content = self._render_template("meeting_reminder.html", context)
        subject = f"Reminder: {meeting_details.get('title', 'Meeting')} starts in {time_until}"
        
        # Send email
        if background_tasks:
            background_tasks.add_task(self._send_email, to_email, subject, html_content)
            logger.info(f"✅ Meeting reminder queued for {to_email}")
        else:
            success = self._send_email(to_email, subject, html_content)
            return success
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send meeting reminder to {to_email}: {e}")
        return False


    async def send_email_notifications(
        self,
        participants: List[Any],
        notification_content: Dict[str, Any],
        background_tasks: Optional[BackgroundTasks] = None
    ) -> List[Dict[str, Any]]:
        """
        Send email notifications to meeting participants using templates
        
        This is the main method that should be called from the API endpoint.
        
        Args:
            participants: List of participant objects (User model)
            notification_content: Dictionary containing:
                - subject: Email subject line
                - meeting_details: Meeting information dictionary
                - custom_message: Optional custom message
                - notification_type: 'invitation' or 'reminder' (default: 'invitation')
                - time_until: For reminders, how long until meeting starts
        """
        results = []
        
        if not self._is_configured():
            logger.warning("Email service not configured, skipping notifications")
            for participant in participants:
                results.append({
                    "participant_id": str(getattr(participant, 'id', 'unknown')),
                    "participant_email": getattr(participant, 'email', None),
                    "type": "email",
                    "status": "skipped",
                    "message": "Email service not configured"
                })
            return results
        
        notification_type = notification_content.get("notification_type", "invitation")
        meeting_details = notification_content.get("meeting_details", {})
        custom_message = notification_content.get("custom_message")
        time_until = notification_content.get("time_until", "soon")
        
        for participant in participants:
            try:
                # Skip if no email address
                if not participant.email:
                    results.append({
                        "participant_id": str(participant.id),
                        "participant_email": None,
                        "type": "email",
                        "status": "skipped",
                        "message": "No email address available"
                    })
                    continue
                
                # Get participant name
                participant_name = (
                    participant.full_name or 
                    participant.username or 
                    participant.email.split('@')[0] if participant.email else "Participant"
                )
                
                success = False
                
                if notification_type == "reminder":
                    success = await self.send_meeting_reminder_email(
                        to_email=participant.email,
                        participant_name=participant_name,
                        meeting_details=meeting_details,
                        time_until=time_until,
                        background_tasks=background_tasks
                    )
                else:  # invitation
                    success = await self.send_meeting_invitation_email(
                        to_email=participant.email,
                        participant_name=participant_name,
                        meeting_details=meeting_details,
                        custom_message=custom_message,
                        background_tasks=background_tasks
                    )
                
                results.append({
                    "participant_id": str(participant.id),
                    "participant_email": participant.email,
                    "participant_name": participant_name,
                    "type": "email",
                    "notification_type": notification_type,
                    "status": "sent" if success else "failed",
                    "message": None if success else "Failed to send email"
                })
                
            except Exception as e:
                logger.error(f"Failed to send email to {getattr(participant, 'email', 'unknown')}: {e}")
                results.append({
                    "participant_id": str(getattr(participant, 'id', 'unknown')),
                    "participant_email": getattr(participant, 'email', None),
                    "type": "email",
                    "status": "error",
                    "message": str(e)
                })
        
        # Log summary
        sent_count = len([r for r in results if r.get("status") == "sent"])
        logger.info(f"📧 Email notifications: {sent_count}/{len(participants)} sent successfully")
        
        return results

# Create singleton instance
email_service = EmailService()