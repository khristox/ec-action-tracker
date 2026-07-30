# app/services/email_service.py - PRODUCTION READY with anti-spam features
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
from email.mime.image import MIMEImage
from email.utils import formatdate, make_msgid, formataddr
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, timedelta
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, TemplateNotFound
from dataclasses import dataclass
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
    """Email configuration with enhanced validation"""
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
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
        use_tls = getattr(settings, 'EMAIL_USE_TLS', True)

        if use_ssl and use_tls:
            logger.warning("Both EMAIL_USE_SSL and EMAIL_USE_TLS are True. Using SSL.")
            use_tls = False

        config = cls(
            host=getattr(settings, 'EMAIL_HOST', None),
            port=int(getattr(settings, 'EMAIL_PORT', 587)),
            username=getattr(settings, 'EMAIL_USER', None),
            password=password,
            from_email=getattr(settings, 'EMAIL_FROM', None),
            from_name=getattr(settings, 'EMAIL_FROM_NAME', 'Action Tracker'),
            use_ssl=use_ssl,
            use_tls=use_tls,
            timeout=int(getattr(settings, 'EMAIL_TIMEOUT', 30)),
        )
        config.is_configured = config._validate()

        if config.is_configured:
            mode = "SSL" if config.use_ssl else "STARTTLS" if config.use_tls else "Plain"
            logger.info(f"Email mode: {mode} on port {config.port}")

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
            logger.warning(f"Missing email config")
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
        self._organization_name = getattr(settings, 'ORGANIZATION_NAME', 'Your Organization')
        self._support_email = getattr(settings, 'SUPPORT_EMAIL', self.config.from_email)
        self._domain = self._extract_domain()
        
        if self.config.is_configured:
            asyncio.create_task(self._test_and_log_connection_async())

    @property
    def frontend_url(self) -> str:
        return getattr(settings, 'FRONTEND_URL', 'http://localhost:8001')

    def _extract_domain(self) -> str:
        """Extract domain from email address"""
        if self.config.from_email and '@' in self.config.from_email:
            return self.config.from_email.split('@')[1]
        return 'yourdomain.com'

    def _get_secret_key(self) -> str:
        if hasattr(settings.SECRET_KEY, 'get_secret_value'):
            return settings.SECRET_KEY.get_secret_value()
        return str(settings.SECRET_KEY)

    def _create_email_message(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        logo_info: Optional[Dict] = None,
        reply_to: Optional[str] = None
    ) -> MIMEMultipart:
        """Create email with comprehensive anti-spam headers"""
        has_cid_logo = bool(logo_info and logo_info.get("type") == "cid")
        
        message = MIMEMultipart("related") if has_cid_logo else MIMEMultipart("alternative")
        
        # ─── ESSENTIAL ANTI-SPAM HEADERS ──────────────────────────────────────
        
        # 1. From with proper display name (critical for deliverability)
        from_header = formataddr((str(self.config.from_name), str(self.config.from_email)))
        message["From"] = from_header
        
        # 2. To header (required)
        message["To"] = to_email
        
        # 3. Subject (clear, concise, no spam triggers)
        message["Subject"] = subject
        
        # 4. Date (RFC 5322 format)
        message["Date"] = formatdate(localtime=True)
        
        # 5. Message-ID (unique, using your domain)
        message["Message-ID"] = make_msgid(domain=self._domain)
        
        # 6. Reply-To (prevents bounce issues)
        reply_to = reply_to or self.config.from_email
        message["Reply-To"] = reply_to
        
        # 7. Sender (helps with SPF)
        message["Sender"] = self.config.from_email
        
        # 8. Return-Path (helps with bounces)
        message["Return-Path"] = f"bounce@{self._domain}"
        
        # ─── ADDITIONAL ANTI-SPAM HEADERS ─────────────────────────────────────
        
        # 9. X-Mailer (identifies sending software)
        message["X-Mailer"] = f"{self._project_name} Email Service"
        
        # 10. X-Priority (normal priority)
        message["X-Priority"] = "3 (Normal)"
        
        # 11. X-Auto-Response-Suppress (prevent auto-replies)
        message["X-Auto-Response-Suppress"] = "All"
        
        # 12. Auto-Submitted (not an auto-reply)
        message["Auto-Submitted"] = "no"
        
        # 13. X-MSMail-Priority (Outlook compatibility)
        message["X-MSMail-Priority"] = "Normal"
        
        # 14. Importance (Standard priority)
        message["Importance"] = "Normal"
        
        # 15. List-Unsubscribe (important for spam filters)
        # This shows email providers you respect recipients
        unsubscribe_url = f"{self.frontend_url}/unsubscribe?email={to_email}"
        message["List-Unsubscribe"] = f"<{unsubscribe_url}>"
        message["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        # ─── CONTENT ──────────────────────────────────────────────────────────
        
        # Create plain text version (CRITICAL for spam filters)
        plain_text = self._html_to_plain_text(html_content)
        plain_text = self._add_plain_text_footer(plain_text)

        if has_cid_logo:
            # Alternative container for text versions
            alt_part = MIMEMultipart("alternative")
            alt_part.attach(MIMEText(plain_text, "plain", "utf-8"))
            alt_part.attach(MIMEText(html_content, "html", "utf-8"))
            message.attach(alt_part)

            # Embed image
            image = MIMEImage(logo_info["data"], _subtype=logo_info["mime_type"].split('/')[-1])
            image.add_header('Content-ID', f'<{logo_info["cid"]}>')
            image.add_header('Content-Disposition', 'inline', 
                           filename=f"logo{Path(logo_info.get('mime_type','')).suffix or '.jpg'}")
            message.attach(image)
        else:
            # Order matters: HTML LAST = preferred per RFC 2046
            message.attach(MIMEText(plain_text, "plain", "utf-8"))
            message.attach(MIMEText(html_content, "html", "utf-8"))

        return message

    def _html_to_plain_text(self, html_content: str) -> str:
        """Convert HTML to plain text with proper formatting"""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', html_content)
        
        # Decode HTML entities
        import html
        text = html.unescape(text)
        
        # Clean up whitespace
        text = re.sub(r'\n\s*\n', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        
        return text.strip()

    def _add_plain_text_footer(self, text: str) -> str:
        """Add footer to plain text version"""
        footer = f"""

---

{self._project_name}
{self._organization_name}
Support: {self._support_email}
Web: {self.frontend_url}

This is an automated message. Please do not reply to this email.

If you didn't request this email, you can safely ignore it.
To unsubscribe, click here: {self.frontend_url}/unsubscribe
"""
        return text + footer

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((smtplib.SMTPServerDisconnected, socket.timeout, ConnectionError))
    )
    def _send_email_sync(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str, 
        logo_info: Optional[Dict] = None
    ) -> Tuple[bool, str]:
        """Send email with retry logic"""
        if not self.config.is_configured:
            return False, "Email service not configured"
        
        server = None
        try:
            message = self._create_email_message(to_email, subject, html_content, logo_info)
            server = self._create_smtp_connection()
            
            if self.config.username and self.config.password:
                server.login(self.config.username, self.config.password)
            
            server.send_message(message)
            logger.info(f"Email sent successfully to {to_email}")
            return True, ""
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"Authentication failed: {e}"
            logger.error(f"Authentication failed: {e}")
            return False, error_msg
            
        except smtplib.SMTPRecipientsRefused as e:
            error_msg = f"Recipient refused: {e}"
            logger.error(f"Recipient refused: {e}")
            return False, error_msg
            
        except smtplib.SMTPServerDisconnected as e:
            logger.error(f"Server disconnected: {e}")
            raise  # Let retry handler deal with this
            
        except Exception as e:
            error_msg = f"Failed to send: {e}"
            logger.error(f"Failed to send email: {e}")
            return False, error_msg
            
        finally:
            if server:
                try:
                    server.quit()
                except:
                    pass

    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        logo_info: Optional[Dict] = None
    ) -> bool:
        """Send email asynchronously"""
        if not to_email:
            logger.warning("No recipient email provided")
            return False
            
        if not self.config.is_configured:
            logger.warning("Email service not configured")
            return False
            
        try:
            loop = asyncio.get_running_loop()
            success, error_msg = await loop.run_in_executor(
                None,
                self._send_email_sync,
                to_email,
                subject,
                html_content,
                logo_info
            )
            
            if not success:
                logger.error(f"Email send failed: {error_msg}")
                
            return success
            
        except Exception as e:
            logger.error(f"Unexpected error sending email to {to_email}: {e}")
            return False

    def _create_smtp_connection(self):
        """Create SMTP connection with proper timeout handling"""
        logger.debug(f"Connecting to {self.config.host}:{self.config.port}")
        
        try:
            if self.config.use_ssl:
                # SSL connection (port 465)
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(
                    self.config.host,
                    self.config.port,
                    context=context,
                    timeout=self.config.timeout
                )
                logger.debug("SSL connection established")
            else:
                # Plain or STARTTLS connection
                server = smtplib.SMTP(
                    self.config.host,
                    self.config.port,
                    timeout=self.config.timeout
                )
                logger.debug("Plain SMTP connection established")
                
                # Upgrade to TLS if configured (port 587)
                if self.config.use_tls:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                    logger.debug("STARTTLS upgrade successful")
            
            return server
            
        except (smtplib.SMTPConnectError, smtplib.SMTPAuthenticationError,
                socket.timeout, ConnectionRefusedError) as e:
            logger.error(f"SMTP connection failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error creating SMTP connection: {e}")
            raise

    def _render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render email template with anti-spam context"""
        default_context = {
            "year": str(datetime.now().year),
            "project_name": self._project_name,
            "organization_name": self._organization_name,
            "support_email": self._support_email,
            "frontend_url": self.frontend_url,
            "current_date": datetime.now().strftime("%B %d, %Y"),
        }
        
        full_context = {**default_context, **(context or {})}
        
        try:
            template = template_env.get_template(template_name)
            return template.render(**full_context)
            
        except TemplateNotFound:
            logger.error(f"Template not found: {template_name}")
            # Fallback HTML
            return self._get_fallback_html(context)
            
        except Exception as e:
            logger.error(f"Template error ({template_name}): {e}")
            raise

    def _get_fallback_html(self, context: Dict[str, Any]) -> str:
        """Generate fallback HTML when template is not found"""
        username = context.get('username', 'User')
        verification_url = context.get('verification_url', '#')
        expires_in_hours = context.get('expires_in_hours', 24)
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f7f9fc;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <h1 style="color: #1a2332; margin: 0 0 20px;">{self._project_name}</h1>
                <h2 style="color: #1a2332;">Verify Your Email</h2>
                <p style="font-size: 16px; color: #4a5568; line-height: 1.6;">Hello <strong>{username}</strong>,</p>
                <p style="font-size: 16px; color: #4a5568; line-height: 1.6;">Please verify your email address by clicking the link below:</p>
                <p style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="display: inline-block; padding: 12px 30px; background-color: #1a2332; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Verify Email</a>
                </p>
                <p style="font-size: 14px; color: #718096;">Or copy and paste this link:</p>
                <p style="font-size: 13px; color: #1a2332; word-break: break-all; background-color: #f7fafc; padding: 12px; border-radius: 4px;">{verification_url}</p>
                <p style="font-size: 14px; color: #718096; margin-top: 20px;">This link expires in <strong>{expires_in_hours} hours</strong>.</p>
                <p style="font-size: 14px; color: #718096; margin-top: 20px;">If you didn't request this, please ignore it.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                <p style="font-size: 12px; color: #a0aec0; text-align: center;">
                    {self._project_name} &middot; {self._organization_name}<br>
                    Support: <a href="mailto:{self._support_email}" style="color: #a0aec0;">{self._support_email}</a>
                </p>
            </div>
        </body>
        </html>
        """

    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Public wrapper around _render_template"""
        return self._render_template(template_name, context)

    # ─── Token Management ──────────────────────────────────────────────────────
    
    def generate_verification_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for email verification"""
        expire = datetime.utcnow() + timedelta(
            hours=getattr(settings, 'EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS', 24)
        )
        
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "email_verification",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"Generated verification token for {email}")
        return token

    def generate_password_reset_token(self, user_id: str, email: str) -> str:
        """Generate JWT token for password reset"""
        expire = datetime.utcnow() + timedelta(
            hours=getattr(settings, 'PASSWORD_RESET_TOKEN_EXPIRE_HOURS', 1)
        )
        
        payload = {
            "user_id": str(user_id),
            "email": str(email),
            "type": "password_reset",
            "exp": expire,
            "iat": datetime.utcnow(),
            "sub": str(user_id)
        }
        
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        logger.info(f"Generated password reset token for {email}")
        return token

    def verify_token(self, token: str, token_type: str) -> Optional[Dict]:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
            
            if payload.get("type") != token_type:
                logger.warning(f"Invalid token type: expected {token_type}")
                return None
                
            return payload
            
        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired {token_type} token")
            return None
            
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid {token_type} token: {e}")
            return None

    # ─── Email Sending Methods ──────────────────────────────────────────────────
    
    async def send_verification_email(
        self, 
        to_email: str, 
        token: str, 
        username: str
    ) -> Dict[str, Any]:
        """Send verification email with anti-spam measures"""
        start_time = time.time()

        if not all([to_email, token, username]):
            return {"success": False, "message": "Missing required parameters"}

        if not self.config.is_configured:
            return {"success": False, "message": "Email service not configured"}

        try:
            verification_url = f"{self.frontend_url}/verify-email?token={token}"

            html_content = self._render_template("verification.html", {
                "username": username,
                "verification_url": verification_url,
                "expires_in_hours": getattr(settings, 'EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS', 24)
            })

            # Clean subject - avoid spam trigger words
            subject = "Verify your email address"

            success = await self.send_email(to_email, subject, html_content)
            elapsed = time.time() - start_time

            if success:
                logger.info(f"Verification email sent to {to_email} in {elapsed:.2f}s")
                return {"success": True, "message": "Verification email sent"}
            else:
                logger.error(f"Failed to send verification email to {to_email}")
                return {"success": False, "message": "Failed to send verification email"}
                
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}", exc_info=True)
            return {"success": False, "message": str(e)}

    async def send_welcome_email(
        self, 
        to_email: str, 
        username: str, 
        first_name: Optional[str] = None
    ) -> bool:
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
                logger.info(f"Welcome email sent to {to_email}")
                
            return success
            
        except Exception as e:
            logger.error(f"Failed to send welcome email: {e}")
            return False

    async def send_password_reset_email(
        self, 
        to_email: str, 
        token: str, 
        username: str
    ) -> bool:
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

            subject = "Reset your password"
            success = await self.send_email(to_email, subject, html_content)
            
            if success:
                logger.info(f"Password reset email sent to {to_email}")
                
            return success
            
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
            return False

    async def send_generic_email(
        self,
        to_email: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any]
    ) -> bool:
        """Send a generic templated email"""
        if not to_email or not self.config.is_configured:
            return False

        try:
            html_content = self._render_template(template_name, context)
            success = await self.send_email(to_email, subject, html_content)
            
            if success:
                logger.info(f"Generic email sent to {to_email}")
                
            return success
            
        except Exception as e:
            logger.error(f"Failed to send generic email: {e}")
            return False

    # ─── Connection Testing ───────────────────────────────────────────────────
    
    async def _test_and_log_connection_async(self):
        """Test SMTP connection asynchronously"""
        try:
            loop = asyncio.get_running_loop()
            success, message = await loop.run_in_executor(None, self._test_connection_sync)
            
            if success:
                logger.info("Email Service: SMTP Connection & Auth Successful")
            else:
                logger.warning(f"Email Service: Connection Test Failed: {message}")
                
        except Exception as e:
            logger.warning(f"Email Service: Connection test error: {e}")

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

    def get_config_info(self) -> Dict[str, Any]:
        """Get email configuration info (safe for logging)"""
        return {
            "host": self.config.host,
            "port": self.config.port,
            "from_email": self.config.from_email,
            "from_name": self.config.from_name,
            "use_ssl": self.config.use_ssl,
            "use_tls": self.config.use_tls,
            "is_configured": self.config.is_configured,
        }


# Create singleton instance
email_service = EmailService()