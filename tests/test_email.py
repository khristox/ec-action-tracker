#!/usr/bin/env python3
"""
Email Service Test Suite
Tests SMTP connection and email sending functionality
"""

import sys
import os
import asyncio
import smtplib
import secrets
import inspect
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load .env file
try:
    from dotenv import load_dotenv
    env_file = project_root / '.env'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded environment from {env_file}")
    else:
        print(f"⚠️ No .env file found at {env_file}")
except ImportError:
    print("⚠️ python-dotenv not installed, using system environment")

from app.core.config import settings
from app.services.email_service import email_service


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


def print_header(text: str):
    """Print formatted header"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text.center(70)}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 70}{Colors.END}\n")


def print_success(text: str):
    """Print success message"""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_error(text: str):
    """Print error message"""
    print(f"{Colors.RED}❌ {text}{Colors.END}")


def print_warning(text: str):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠️ {text}{Colors.END}")


def print_info(text: str):
    """Print info message"""
    print(f"{Colors.BLUE}ℹ️ {text}{Colors.END}")


def print_config(label: str, value: Any, is_sensitive: bool = False):
    """Print configuration value"""
    if is_sensitive and value:
        value = "✓ Set" if value else "✗ Not set"
    print(f"   {label}: {Colors.BOLD}{value}{Colors.END}")


class EmailTester:
    """Comprehensive email service tester"""
    
    def __init__(self):
        self.test_email = "khristox@gmail.com"
        self.results = {
            "config_valid": False,
            "dns_resolution": False,
            "tcp_connection": False,
            "smtp_connection": False,
            "authentication": False,
            "test_email_sent": False,
            "verification_email_sent": False
        }
    
    def display_configuration(self):
        """Display current email configuration"""
        print_header("📧 EMAIL CONFIGURATION")
        
        print_config("Host", settings.EMAIL_HOST)
        print_config("Port", settings.EMAIL_PORT)
        print_config("Username", settings.EMAIL_USER)
        print_config("Password", settings.EMAIL_PASSWORD, is_sensitive=True)
        print_config("From Email", settings.EMAIL_FROM)
        print_config("From Name", getattr(settings, 'EMAIL_FROM_NAME', 'Action Tracker'))
        print_config("Use SSL", settings.EMAIL_USE_SSL)
        print_config("Use TLS", getattr(settings, 'EMAIL_USE_TLS', False))
        print_config("Timeout", getattr(settings, 'EMAIL_TIMEOUT', 30))
        
        # Validate configuration
        required = [settings.EMAIL_HOST, settings.EMAIL_USER, settings.EMAIL_PASSWORD, settings.EMAIL_FROM]
        if all(required):
            self.results["config_valid"] = True
            print_success("Email configuration is complete")
        else:
            missing = []
            if not settings.EMAIL_HOST: missing.append("EMAIL_HOST")
            if not settings.EMAIL_USER: missing.append("EMAIL_USER")
            if not settings.EMAIL_PASSWORD: missing.append("EMAIL_PASSWORD")
            if not settings.EMAIL_FROM: missing.append("EMAIL_FROM")
            print_error(f"Missing configuration: {', '.join(missing)}")
    
    def test_dns_resolution(self) -> bool:
        """Test DNS resolution of email host"""
        print_header("🌐 DNS RESOLUTION TEST")
        
        import socket
        hostname = settings.EMAIL_HOST
        
        try:
            print_info(f"Resolving {hostname}...")
            ips = socket.gethostbyname_ex(hostname)
            print_success(f"DNS resolution successful")
            print(f"   Canonical name: {ips[0]}")
            print(f"   IP addresses: {', '.join(ips[2])}")
            self.results["dns_resolution"] = True
            return True
        except socket.gaierror as e:
            print_error(f"DNS resolution failed: {e}")
            return False
        except Exception as e:
            print_error(f"Unexpected error: {e}")
            return False
    
    def test_tcp_connection(self) -> bool:
        """Test TCP connection to SMTP server"""
        print_header("🔌 TCP CONNECTION TEST")
        
        import socket
        hostname = settings.EMAIL_HOST
        port = settings.EMAIL_PORT
        
        try:
            print_info(f"Testing TCP connection to {hostname}:{port}...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(10)
            result = sock.connect_ex((hostname, port))
            sock.close()
            
            if result == 0:
                print_success(f"TCP connection successful to {hostname}:{port}")
                self.results["tcp_connection"] = True
                return True
            else:
                print_error(f"TCP connection failed (error code: {result})")
                return False
        except Exception as e:
            print_error(f"TCP connection test failed: {e}")
            return False
    
    def test_smtp_connection(self) -> bool:
        """Test SMTP connection and authentication"""
        print_header("🔐 SMTP CONNECTION & AUTHENTICATION TEST")
        
        try:
            # Create connection
            print_info(f"Connecting to {settings.EMAIL_HOST}:{settings.EMAIL_PORT}...")
            
            if settings.EMAIL_USE_SSL:
                import ssl
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(
                    settings.EMAIL_HOST,
                    settings.EMAIL_PORT,
                    context=context,
                    timeout=30
                )
                print_success("SSL connection established")
            else:
                server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=30)
                print_success("SMTP connection established")
                
                if getattr(settings, 'EMAIL_USE_TLS', False):
                    server.starttls()
                    print_success("TLS encryption enabled")
            
            # Get server banner
            banner = server.ehlo()[1]
            print_info(f"Server banner: {banner[:100]}...")
            self.results["smtp_connection"] = True
            
            # Test authentication
            print_info(f"Authenticating as {settings.EMAIL_USER}...")
            password = settings.EMAIL_PASSWORD
            if hasattr(password, 'get_secret_value'):
                password = password.get_secret_value()
            
            server.login(settings.EMAIL_USER, password)
            print_success("Authentication successful")
            self.results["authentication"] = True
            
            server.quit()
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            print_error(f"Authentication failed: {e}")
            print_warning("Check your EMAIL_USER and EMAIL_PASSWORD")
            return False
        except smtplib.SMTPConnectError as e:
            print_error(f"SMTP connection failed: {e}")
            return False
        except Exception as e:
            print_error(f"Connection error: {e}")
            return False
    

    def test_send_raw_email(self) -> bool:
        """Test sending a raw test email"""
        print_header("📧 RAW EMAIL TEST")
        
        try:
            print_info(f"Preparing test email to {self.test_email}...")
            
            # Create connection
            if settings.EMAIL_USE_SSL:
                import ssl
                context = ssl.create_default_context()
                server = smtplib.SMTP_SSL(
                    settings.EMAIL_HOST,
                    settings.EMAIL_PORT,
                    context=context,
                    timeout=30
                )
            else:
                server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=30)
                if getattr(settings, 'EMAIL_USE_TLS', False):
                    server.starttls()
            
            # Login
            password = settings.EMAIL_PASSWORD
            if hasattr(password, 'get_secret_value'):
                password = password.get_secret_value()
            server.login(settings.EMAIL_USER, password)
            
            # Create email
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{getattr(settings, 'EMAIL_FROM_NAME', 'Action Tracker')} <{settings.EMAIL_FROM}>"
            msg['To'] = self.test_email
            msg['Subject'] = f"Test Email - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            
            # Get current timestamp
            current_timestamp = datetime.now().isoformat()
            
            # Plain text version
            text_body = f"""
            This is a test email from Action Tracker.
            
            Timestamp: {current_timestamp}
            Server: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}
            
            If you received this, your SMTP configuration is working correctly!
            """
            
            # HTML version
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px;">
                    <h2>Action Tracker Test Email</h2>
                </div>
                <div style="padding: 20px;">
                    <p>This is a test email to verify SMTP configuration.</p>
                    <p><strong>Timestamp:</strong> {current_timestamp}</p>
                    <p><strong>Server:</strong> {settings.EMAIL_HOST}:{settings.EMAIL_PORT}</p>
                    <p>If you received this, your email service is working correctly!</p>
                </div>
                <div style="text-align: center; padding: 20px; font-size: 12px; color: #666;">
                    <p>© {datetime.now().year} Action Tracker</p>
                </div>
            </body>
            </html>
            """
            
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            # Send
            print_info("Sending test email...")
            server.send_message(msg)
            server.quit()
            
            print_success(f"Test email sent successfully to {self.test_email}")
            self.results["test_email_sent"] = True
            return True
            
        except Exception as e:
            print_error(f"Failed to send test email: {e}")
            return False

    async def test_verification_email(self) -> bool:
        """Test sending verification email using the service"""
        print_header("📧 VERIFICATION EMAIL TEST")
        
        try:
            # Generate test token
            test_token = secrets.token_urlsafe(32)
            
            print_info(f"Sending verification email to {self.test_email}...")
            
            # Check if email service has the method
            if not hasattr(email_service, 'send_verification_email'):
                print_warning("send_verification_email method not available")
                print_info(f"Available methods: {[m for m in dir(email_service) if not m.startswith('_') and callable(getattr(email_service, m))]}")
                return False
            
            # Check if the method is async
            method = email_service.send_verification_email
            is_async = inspect.iscoroutinefunction(method)
            
            # Prepare parameters based on signature
            sig = inspect.signature(method)
            params = sig.parameters
            
            # Build kwargs based on what the method expects
            kwargs = {}
            
            if 'to_email' in params:
                kwargs['to_email'] = self.test_email
            elif 'email' in params:
                kwargs['email'] = self.test_email
            else:
                kwargs['to_email'] = self.test_email
            
            if 'username' in params:
                kwargs['username'] = "Test User"
            
            if 'token' in params:
                kwargs['token'] = test_token
            elif 'verification_token' in params:
                kwargs['verification_token'] = test_token
            
            if 'user_id' in params:
                kwargs['user_id'] = "test-user-123"
            
            print_info(f"Calling send_verification_email with kwargs: {list(kwargs.keys())}")
            
            # Call the method (async or sync)
            if is_async:
                result = await method(**kwargs)
            else:
                result = method(**kwargs)
            
            # Check result
            if isinstance(result, dict):
                if result.get("success"):
                    print_success(f"Verification email sent successfully")
                    self.results["verification_email_sent"] = True
                    return True
                else:
                    print_error(f"Failed to send: {result.get('message', 'Unknown error')}")
                    return False
            elif isinstance(result, bool):
                if result:
                    print_success(f"Verification email sent successfully")
                    self.results["verification_email_sent"] = True
                    return True
                else:
                    print_error(f"Failed to send verification email")
                    return False
            else:
                print_success(f"Verification email sent (response: {result})")
                self.results["verification_email_sent"] = True
                return True
                
        except TypeError as e:
            print_error(f"Type error: {e}")
            print_info("Check the method signature and parameters")
            # Print the actual signature for debugging
            if hasattr(email_service, 'send_verification_email'):
                sig = inspect.signature(email_service.send_verification_email)
                print_info(f"Expected signature: {sig}")
            return False
        except Exception as e:
            print_error(f"Verification email test failed: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def test_service_methods(self):
        """Test available email service methods"""
        print_header("🔍 AVAILABLE SERVICE METHODS")
        
        methods = [m for m in dir(email_service) if not m.startswith('_') and callable(getattr(email_service, m))]
        
        for method in methods:
            try:
                func = getattr(email_service, method)
                sig = inspect.signature(func)
                is_async = "async" if inspect.iscoroutinefunction(func) else "sync"
                params = list(sig.parameters.keys())
                print(f"   {Colors.BOLD}{method}{Colors.END} [{is_async}]({', '.join(params)})")
            except:
                print(f"   {Colors.BOLD}{method}{Colors.END}(...)")
    
    def print_summary(self):
        """Print test summary"""
        print_header("📊 TEST SUMMARY")
        
        summary = [
            ("Configuration Valid", self.results["config_valid"]),
            ("DNS Resolution", self.results["dns_resolution"]),
            ("TCP Connection", self.results["tcp_connection"]),
            ("SMTP Connection", self.results["smtp_connection"]),
            ("Authentication", self.results["authentication"]),
            ("Raw Email Test", self.results["test_email_sent"]),
            ("Verification Email", self.results["verification_email_sent"]),
        ]
        
        for name, status in summary:
            if status:
                print(f"   ✅ {name}")
            else:
                print(f"   ❌ {name}")
        
        # Overall status
        print(f"\n{Colors.BOLD}Overall Status:{Colors.END}")
        all_passed = all([self.results["config_valid"], self.results["dns_resolution"], 
                         self.results["tcp_connection"], self.results["smtp_connection"], 
                         self.results["authentication"]])
        
        if all_passed:
            print_success("Email service is ready to use!")
        else:
            print_error("Email service has configuration issues")
            print_warning("Check the failing tests above for details")
    
    async def run_all_tests(self):
        """Run all tests"""
        print_header("🚀 EMAIL SERVICE TEST SUITE")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Test Email: {self.test_email}")
        
        # Run tests
        self.display_configuration()
        
        if not self.results["config_valid"]:
            print_error("Cannot proceed with tests due to invalid configuration")
            return
        
        self.test_dns_resolution()
        self.test_tcp_connection()
        self.test_smtp_connection()
        
        # Only proceed if basic connectivity works
        if self.results["authentication"]:
            self.test_send_raw_email()
            await self.test_verification_email()  # This is now properly async
        else:
            print_warning("Skipping email sending tests due to authentication failure")
        
        self.test_service_methods()
        self.print_summary()


async def quick_test():
    """Quick test function for rapid debugging"""
    print_header("⚡ QUICK TEST")
    
    tester = EmailTester()
    
    # Just test basic connectivity
    tester.display_configuration()
    
    if tester.results["config_valid"]:
        tester.test_dns_resolution()
        tester.test_tcp_connection()
        tester.test_smtp_connection()
        
        if tester.results["authentication"]:
            tester.test_send_raw_email()
    else:
        print_error("Fix configuration before running tests")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Email Service")
    parser.add_argument("--quick", action="store_true", help="Run quick test only")
    parser.add_argument("--email", type=str, help="Test email recipient")
    args = parser.parse_args()
    
    # Create tester instance
    tester = EmailTester()
    
    if args.email:
        tester.test_email = args.email
        print_info(f"Using custom test email: {tester.test_email}")
    
    # Run tests
    if args.quick:
        asyncio.run(quick_test())
    else:
        asyncio.run(tester.run_all_tests())