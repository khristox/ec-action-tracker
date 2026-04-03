import smtplib
import ssl
import socket
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import jwt
import logging
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
from fastapi import BackgroundTasks
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger(__name__)

# Set up Jinja2 template environment
template_dir = Path(__file__).parent.parent / "templates" / "email"
template_env = Environment(loader=FileSystemLoader(template_dir))

@dataclass
class EmailConfig:
    """Email configuration dataclass"""
    host: str
    port: int
    username: str
    password: str
    from_email: str
    from_name: str
    use_ssl: bool
    use_tls: bool
    is_configured: bool = False
    
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
        """Validate email configuration"""
        valid = all([
            self.host,
            self.username,
            self.password,
            self.from_email
        ])
        if not valid:
            missing = []
            if not self.host:
                missing.append("EMAIL_HOST")
            if not self.username:
                missing.append("EMAIL_USER")
            if not self.password:
                missing.append("EMAIL_PASSWORD")
            if not self.from_email:
                missing.append("EMAIL_FROM")
            logger.warning(f"Email service missing configuration: {', '.join(missing)}")
        return valid


class EmailService:
    """Service for sending emails with enhanced error handling"""
    
    def __init__(self):
        self.config = EmailConfig.from_settings()
        self._secret_key = self._get_secret_key()
        self._algorithm = getattr(settings, 'ALGORITHM', 'HS256')
        self._backend_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8001')
        self._api_prefix = getattr(settings, 'API_V1_STR', '/api/v1')
        self._frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        
        self._log_initialization()
        
        # Test connection on startup in debug mode
        if getattr(settings, 'DEBUG', False) and self.config.is_configured:
            success, diag = self._test_connection()
            if not success:
                logger.warning("⚠️ Email service connection test failed")
                logger.warning(f"   Diagnostics: {diag.get('error', 'Unknown error')}")
    
    def _get_secret_key(self) -> str:
        """Extract secret key as string from settings"""
        try:
            if hasattr(settings.SECRET_KEY, 'get_secret_value'):
                return settings.SECRET_KEY.get_secret_value()
            return str(settings.SECRET_KEY)
        except Exception as e:
            logger.error(f"Failed to get secret key: {e}")
            raise ValueError("SECRET_KEY not properly configured")
    
    def _log_initialization(self):
        """Log email service initialization status"""
        logger.info("=" * 60)
        logger.info("📧 Email Service Initialization")
        logger.info("=" * 60)
        logger.info(f"   Host: {self.config.host}")
        logger.info(f"   Port: {self.config.port}")
        logger.info(f"   Username: {self.config.username}")
        logger.info(f"   Password: {'✓ Set' if self.config.password else '✗ Not set'}")
        logger.info(f"   From: {self.config.from_email}")
        logger.info(f"   Name: {self.config.from_name}")
        logger.info(f"   SSL: {self.config.use_ssl}")
        logger.info(f"   TLS: {self.config.use_tls}")
        logger.info(f"   Configured: {self.config.is_configured}")
        logger.info(f"   Backend URL: {self._backend_url}")
        logger.info(f"   API Prefix: {self._api_prefix}")
        logger.info(f"   Frontend URL: {self._frontend_url}")
        logger.info("=" * 60)
    
    def _is_configured(self) -> bool:
        """Check if email service is configured"""
        return self.config.is_configured
    
    def _resolve_hostname(self, hostname: str) -> Tuple[bool, list]:
        """Resolve hostname to IP addresses"""
        try:
            ips = socket.gethostbyname_ex(hostname)
            return True, ips[2]  # Return list of IPs
        except socket.gaierror as e:
            logger.error(f"DNS resolution failed for {hostname}: {e}")
            return False, []
        except Exception as e:
            logger.error(f"Unexpected error resolving {hostname}: {e}")
            return False, []
    
    def _test_connection(self) -> Tuple[bool, dict]:
        """
        Test SMTP connection and return detailed diagnostics
        """
        diagnostics = {
            "host": self.config.host,
            "port": self.config.port,
            "use_ssl": self.config.use_ssl,
            "use_tls": self.config.use_tls,
            "timestamp": datetime.now().isoformat(),
            "resolved_ips": [],
            "connection_success": False,
            "tls_success": False,
            "error": None,
            "server_banner": None
        }
        
        # Resolve DNS
        success, ips = self._resolve_hostname(self.config.host)
        if success:
            diagnostics["resolved_ips"] = ips
            logger.info(f"📡 DNS resolution for {self.config.host}: {ips}")
        else:
            diagnostics["error"] = f"DNS resolution failed for {self.config.host}"
            logger.error(diagnostics["error"])
            return False, diagnostics
        
        # Test TCP connection to each IP
        for ip in ips[:3]:  # Test first 3 IPs
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(10)
                result = sock.connect_ex((ip, self.config.port))
                sock.close()
                
                if result == 0:
                    logger.info(f"✅ TCP connection successful to {ip}:{self.config.port}")
                    diagnostics["connection_success"] = True
                    break
                else:
                    logger.warning(f"❌ TCP connection failed to {ip}:{self.config.port} (error: {result})")
            except Exception as e:
                logger.warning(f"Error testing {ip}:{self.config.port}: {e}")
        
        # If TCP connection is possible, try full SMTP connection
        if diagnostics["connection_success"]:
            try:
                server = self._create_smtp_connection()
                diagnostics["server_banner"] = server.ehlo()[1]
                server.quit()
                diagnostics["connection_success"] = True
                logger.info("✅ Full SMTP connection test passed")
            except Exception as e:
                diagnostics["error"] = f"SMTP connection failed: {e}"
                diagnostics["connection_success"] = False
                logger.error(diagnostics["error"])
        
        return diagnostics["connection_success"], diagnostics
    
    def _create_smtp_connection(self):
        """Create SMTP connection based on settings with detailed logging"""
        if not self.config.is_configured:
            raise ValueError("Email service not configured properly")
        
        # Resolve and log SMTP server IP
        success, ips = self._resolve_hostname(self.config.host)
        server_ip = ips[0] if success else "unknown"
        
        logger.info(f"📧 Connecting to SMTP server: {self.config.host}:{self.config.port}")
        logger.info(f"   Resolved IP: {server_ip}")
        
        try:
            if self.config.use_ssl:
                logger.info(f"   Using SSL (port {self.config.port})")
                context = ssl.create_default_context()
                
                # Optional: For debugging SSL connections
                if hasattr(context, 'set_ciphers'):
                    context.set_ciphers('DEFAULT')
                
                server = smtplib.SMTP_SSL(
                    self.config.host, 
                    self.config.port, 
                    context=context,
                    timeout=30,
                    source_address=None
                )
                
                # Log connection details
                if server.sock:
                    remote_host, remote_port = server.sock.getpeername()
                    local_host, local_port = server.sock.getsockname()
                    logger.info(f"   ✅ Connected to {remote_host}:{remote_port}")
                    logger.info(f"   Local endpoint: {local_host}:{local_port}")
                
            else:
                logger.info(f"   Using {'TLS' if self.config.use_tls else 'plain'} connection")
                server = smtplib.SMTP(self.config.host, self.config.port, timeout=30)
                
                # Log connection details
                if server.sock:
                    remote_host, remote_port = server.sock.getpeername()
                    local_host, local_port = server.sock.getsockname()
                    logger.info(f"   Connected to {remote_host}:{remote_port}")
                    logger.info(f"   Local endpoint: {local_host}:{local_port}")
                
                if self.config.use_tls:
                    logger.info("   Starting TLS...")
                    server.starttls()
                    
                    # Log after TLS upgrade
                    if server.sock:
                        tls_host, tls_port = server.sock.getpeername()
                        logger.info(f"   TLS established to {tls_host}:{tls_port}")
            
            # Get server banner/helo response
            try:
                helo_response = server.ehlo()
                if helo_response and helo_response[0] == 250:
                    server_info = helo_response[1].split()[0] if helo_response[1] else "unknown"
                    logger.info(f"   SMTP server: {server_info}")
            except Exception as e:
                logger.debug(f"   Could not get EHLO response: {e}")
            
            return server
            
        except smtplib.SMTPConnectError as e:
            logger.error(f"❌ SMTP connection failed to {self.config.host}:{self.config.port}")
            logger.error(f"   Error: {e}")
            logger.error(f"   Resolved IP: {server_ip}")
            logger.error(f"   Check if the server is accessible and port {self.config.port} is open")
            logger.error(f"   You can test with: telnet {self.config.host} {self.config.port}")
            raise
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ SMTP authentication failed: {e}")
            logger.error(f"   Username: {self.config.username}")
            logger.error(f"   Check EMAIL_USER and EMAIL_PASSWORD in your .env file")
            logger.error(f"   For Gmail, you need an App Password, not your regular password")
            raise
        except socket.timeout:
            logger.error(f"❌ Connection timeout to {self.config.host}:{self.config.port}")
            logger.error(f"   Resolved IP: {server_ip}")
            logger.error(f"   Check firewall rules and network connectivity")
            logger.error(f"   Verify the server is accepting connections on port {self.config.port}")
            raise
        except ConnectionRefusedError as e:
            logger.error(f"❌ Connection refused to {self.config.host}:{self.config.port}")
            logger.error(f"   Resolved IP: {server_ip}")
            logger.error(f"   Error: {e}")
            logger.error(f"   The server is not accepting connections on this port")
            logger.error(f"   Verify the correct port and that the SMTP service is running")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to create SMTP connection: {e}")
            logger.error(f"   Host: {self.config.host}:{self.config.port}")
            logger.error(f"   Resolved IP: {server_ip}")
            logger.error(f"   Error type: {type(e).__name__}")
            raise
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SMTP with enhanced error handling"""
        if not self.config.is_configured:
            logger.error("Cannot send email: Service not configured")
            return False
        
        if not to_email or not isinstance(to_email, str):
            logger.error(f"Invalid recipient email: {to_email}")
            return False
        
        server = None
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.config.from_name} <{self.config.from_email}>"
            message["To"] = to_email
            message.attach(MIMEText(html_content, "html"))
            
            # Send email
            server = self._create_smtp_connection()
            
            # Log authentication attempt
            logger.debug(f"Authenticating as {self.config.username}")
            server.login(self.config.username, self.config.password)
            logger.debug("✅ Authentication successful")
            
            # Send the message
            logger.debug(f"Sending email to {to_email}")
            server.send_message(message)
            
            logger.info(f"✅ Email sent successfully to {to_email}")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"❌ Authentication failed: {e}")
            logger.error(f"   Username: {self.config.username}")
            logger.error("   Solution: Check EMAIL_USER and EMAIL_PASSWORD in .env")
            logger.error("   For Gmail: Use an App Password (https://myaccount.google.com/apppasswords)")
            return False
        except smtplib.SMTPConnectError as e:
            logger.error(f"❌ Connection failed: {e}")
            logger.error(f"   SMTP Server: {self.config.host}:{self.config.port}")
            logger.error("   Solution: Verify server address and port, check firewall")
            return False
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"❌ Server disconnected: {e}")
            logger.error("   Solution: Check network stability and server availability")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"❌ Recipient refused: {e}")
            logger.error(f"   Recipient email: {to_email}")
            logger.error("   Solution: Verify the email address is valid")
            return False
        except smtplib.SMTPDataError as e:
            logger.error(f"❌ Data error: {e}")
            logger.error("   Solution: Check email content for issues")
            return False
        except socket.timeout:
            logger.error(f"❌ Socket timeout while sending email")
            logger.error(f"   SMTP Server: {self.config.host}:{self.config.port}")
            logger.error("   Solution: Increase timeout or check network latency")
            return False
        except Exception as e:
            logger.error(f"❌ Failed to send email: {e}", exc_info=True)
            return False
        finally:
            if server:
                try:
                    server.quit()
                    logger.debug("SMTP connection closed")
                except:
                    pass
    
    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render HTML template with context"""
        if not context:
            context = {}
        
        # Convert all values to strings
        context = {k: str(v) if v is not None else '' for k, v in context.items()}
        
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
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Verification</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #1976d2;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin: 20px 0;
                    }}
                    .footer {{
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #eee;
                        font-size: 12px;
                        color: #666;
                    }}
                </style>
            </head>
            <body>
                <h1>Verify Your Email Address</h1>
                <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
                <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
                <p>Click the button below to verify your email:</p>
                <a href="{context.get('verification_url', '#')}" class="button">Verify Email</a>
                <p>This link will expire in <strong>{context.get('expires_in_hours', '24')} hours</strong>.</p>
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <div class="footer">
                    <p>&copy; {context.get('year', datetime.utcnow().year)} {settings.PROJECT_NAME}. All rights reserved.</p>
                    <p>Need help? Contact us at <a href="mailto:{context.get('support_email', 'support@example.com')}">{context.get('support_email', 'support@example.com')}</a></p>
                </div>
            </body>
            </html>
            """
        elif "welcome" in template_name:
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to {settings.PROJECT_NAME}</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #1976d2;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin: 20px 0;
                    }}
                </style>
            </head>
            <body>
                <h1>Welcome to {settings.PROJECT_NAME}!</h1>
                <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
                <p>Your email has been successfully verified. You can now log in to your account:</p>
                <a href="{context.get('login_url', '#')}" class="button">Login Now</a>
                <p>We're excited to have you on board!</p>
            </body>
            </html>
            """
        elif "password_reset" in template_name:
            return f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Password Reset Request</title>
                <style>
                    body {{
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #1976d2;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin: 20px 0;
                    }}
                </style>
            </head>
            <body>
                <h1>Password Reset Request</h1>
                <p>Hello <strong>{context.get('username', 'User')}</strong>,</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <a href="{context.get('reset_url', '#')}" class="button">Reset Password</a>
                <p>This link will expire in <strong>{context.get('expires_in_hours', '24')} hours</strong>.</p>
                <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </body>
            </html>
            """
        else:
            return f"<html><body><p>{context.get('message', 'Email from SWAHILLI')}</p></body></html>"
    
    def generate_verification_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for email verification"""
        if not user_id or not email:
            raise ValueError("user_id and email are required")
        
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "email_verification",
            "exp": datetime.utcnow() + timedelta(hours=settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
    
    def generate_password_reset_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for password reset"""
        if not user_id or not email:
            raise ValueError("user_id and email are required")
        
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "password_reset",
            "exp": datetime.utcnow() + timedelta(hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
    
    def verify_token(self, token: str, token_type: str) -> Optional[Dict]:
        """Verify JWT token"""
        if not token:
            return None
        
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
            return payload if payload.get("type") == token_type else None
        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired {token_type} token")
            return None
        except jwt.InvalidTokenError:
            logger.warning(f"Invalid {token_type} token")
            return None
    
    async def send_verification_email(
        self,
        to_email: str,
        username: str,
        user_id: str,
        background_tasks: BackgroundTasks,
        verification_type: str = "email_verification"
    ) -> Dict[str, Any]:
        """
        Send email verification email
        
        Args:
            to_email: Recipient email address
            username: User's username
            user_id: User's ID
            background_tasks: FastAPI BackgroundTasks instance
            verification_type: Type of verification ('email_verification' or 'email_change')
        
        Returns:
            Dict with status and message
        """
        # Validate inputs
        if not all([to_email, user_id]):
            logger.error("Missing required parameters: to_email and user_id are required")
            return {
                "success": False,
                "message": "Missing required parameters"
            }
        
        if not self._is_configured():
            logger.error("Email service not configured")
            return {
                "success": False,
                "message": "Email service is not configured. Please contact support."
            }
        
        try:
            # Generate verification token
            token = self.generate_verification_token(user_id, to_email)
            
            # Construct verification URL
            verification_url = f"{self._backend_url}{self._api_prefix}/auth/verify-email?token={token}&type={verification_type}"
            
            # Prepare email context
            context = {
                "username": username or "User",
                "verification_url": verification_url,
                "expires_in_hours": str(settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
                "support_email": self.config.from_email,
                "year": str(datetime.utcnow().year),
                "project_name": settings.PROJECT_NAME,
                "verification_type": verification_type
            }
            
            # Render email template
            html_content = self._render_template("verification.html", context)
            
            # Send email via background task
            if background_tasks:
                background_tasks.add_task(
                    self._send_email,
                    to_email,
                    f"Verify Your Email Address - {settings.PROJECT_NAME}",
                    html_content
                )
                logger.info(f"✅ Verification email queued for {to_email}")
                return {
                    "success": True,
                    "message": "Verification email sent successfully",
                    "queued": True
                }
            else:
                # Send synchronously if no background tasks
                success = self._send_email(
                    to_email,
                    f"Verify Your Email Address - {settings.PROJECT_NAME}",
                    html_content
                )
                if success:
                    logger.info(f"✅ Verification email sent to {to_email}")
                    return {
                        "success": True,
                        "message": "Verification email sent successfully"
                    }
                else:
                    return {
                        "success": False,
                        "message": "Failed to send verification email"
                    }
            
        except Exception as e:
            logger.error(f"❌ Failed to send verification email: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"Failed to send verification email: {str(e)}"
            }
    
    async def send_verification_email_sync(
        self,
        to_email: str,
        username: str,
        user_id: str,
        verification_type: str = "email_verification"
    ) -> Dict[str, Any]:
        """
        Send email verification email synchronously (without background tasks)
        
        Args:
            to_email: Recipient email address
            username: User's username
            user_id: User's ID
            verification_type: Type of verification ('email_verification' or 'email_change')
        
        Returns:
            Dict with status and message
        """
        return await self.send_verification_email(
            to_email=to_email,
            username=username,
            user_id=user_id,
            background_tasks=None,
            verification_type=verification_type
        )
    
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
                "support_email": self.config.from_email,
                "year": str(datetime.utcnow().year),
                "project_name": settings.PROJECT_NAME
            }
            
            html_content = self._render_template("welcome.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Welcome to {settings.PROJECT_NAME}!",
                html_content
            )
            
            logger.info(f"Welcome email queued for {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
            return False
    
    async def send_password_reset_email(
        self,
        to_email: str,
        username: str,
        user_id: str,
        background_tasks: BackgroundTasks
    ) -> bool:
        """Send password reset email"""
        if not to_email or not user_id:
            logger.error("Email and user ID required for password reset")
            return False
        
        if not self._is_configured():
            logger.error("Email service not configured, skipping password reset email")
            return False
        
        try:
            token = self.generate_password_reset_token(user_id, to_email)
            
            # Construct the full reset URL with API prefix
            reset_url = f"{self._backend_url}{self._api_prefix}/auth/reset-password?token={token}"
            
            logger.info(f"Reset URL: {reset_url}")
            
            context = {
                "username": str(username or "User"),
                "reset_url": str(reset_url),
                "expires_in_hours": str(settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS),
                "support_email": self.config.from_email,
                "year": str(datetime.utcnow().year),
                "project_name": settings.PROJECT_NAME
            }
            
            html_content = self._render_template("password_reset.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Reset Your Password - {settings.PROJECT_NAME}",
                html_content
            )
            
            logger.info(f"Password reset email queued for {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}", exc_info=True)
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
                "support_email": self.config.from_email,
                "year": str(datetime.utcnow().year),
                "project_name": settings.PROJECT_NAME
            }
            
            html_content = self._render_template("password_reset_confirmation.html", context)
            
            background_tasks.add_task(
                self._send_email,
                to_email,
                f"Password Reset Confirmation - {settings.PROJECT_NAME}",
                html_content
            )
            
            logger.info(f"Password reset confirmation email queued for {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send password reset confirmation email: {e}")
            return False
    
    async def resend_verification_email(
        self,
        to_email: str,
        username: str,
        user_id: str,
        background_tasks: BackgroundTasks
    ) -> Dict[str, Any]:
        """
        Resend verification email (alias for send_verification_email)
        """
        return await self.send_verification_email(
            to_email=to_email,
            username=username,
            user_id=user_id,
            background_tasks=background_tasks
        )


# Create singleton instance
email_service = EmailService()