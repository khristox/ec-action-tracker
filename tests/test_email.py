#!/usr/bin/env python3
"""
Test email service functionality
"""
import sys
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
load_dotenv(project_root / '.env')

from fastapi import BackgroundTasks
from app.services.email_service import email_service
from app.core.config import settings

async def test_email():
    """Test sending emails"""
    
    print("=" * 60)
    print("Testing Email Service")
    print("=" * 60)
    
    print(f"\n📧 Email Configuration:")
    print(f"   Host: {settings.EMAIL_HOST}")
    print(f"   Port: {settings.EMAIL_PORT}")
    print(f"   User: {settings.EMAIL_USER}")
    print(f"   From: {settings.EMAIL_FROM}")
    print(f"   From Name: {settings.EMAIL_FROM_NAME}")
    print(f"   Use SSL: {settings.EMAIL_USE_SSL}")
    
    # Check if email is configured
    if not settings.EMAIL_HOST or not settings.EMAIL_USER:
        print("\n❌ Email service not configured properly!")
        print("   Please check your .env file")
        return
    
    # Test SMTP connection first
    print("\n🔌 Testing SMTP connection...")
    try:
        # Try to connect and send a simple test email
        # Use the correct method - check what's available
        if hasattr(email_service, 'test_connection'):
            result = await email_service.test_connection()
            print(f"   Connection test: {'✅ OK' if result else '❌ Failed'}")
        else:
            print("   No test_connection method available")
    except Exception as e:
        print(f"   ❌ Connection test failed: {str(e)}")
    
    # Send test email
    print("\n📧 Sending test email...")
    background_tasks = BackgroundTasks()
    
    try:
        # Option 1: If method expects verification_token
        if hasattr(email_service, 'send_verification_email'):
            # Generate a test token
            import secrets
            test_token = secrets.token_urlsafe(32)
            
            result = await email_service.send_verification_email(
                to_email="khristox@gmail.com",
                username="TestUser",
                verification_token=test_token,  # Use verification_token instead of user_id
                background_tasks=background_tasks
            )
            print(f"   Result: {'✅ Queued' if result else '❌ Failed'}")
        
        # Option 2: If there's a generic send_email method
        elif hasattr(email_service, 'send_email'):
            result = await email_service.send_email(
                to_email="khristox@gmail.com",
                subject="Test Email from Action Tracker",
                body="This is a test email to verify SMTP configuration.",
                background_tasks=background_tasks
            )
            print(f"   Result: {'✅ Queued' if result else '❌ Failed'}")
        
        else:
            print("   ❌ No suitable email method found")
            print(f"   Available methods: {[m for m in dir(email_service) if not m.startswith('_')]}")
            
    except TypeError as e:
        print(f"   ❌ Type error: {e}")
        print("\n📋 Checking available method signatures...")
        import inspect
        if hasattr(email_service, 'send_verification_email'):
            sig = inspect.signature(email_service.send_verification_email)
            print(f"   send_verification_email expects: {sig}")
    
    # Wait for background tasks
    await asyncio.sleep(5)
    print("\n✅ Test completed!")

async def test_simple_email():
    """Simpler test - just send a raw email"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    print("\n" + "=" * 60)
    print("Testing Raw SMTP Connection")
    print("=" * 60)
    
    host = settings.EMAIL_HOST
    port = settings.EMAIL_PORT
    username = settings.EMAIL_USER
    password = settings.EMAIL_PASSWORD
    
    print(f"\nConnecting to {host}:{port}...")
    
    try:
        if settings.EMAIL_USE_SSL:
            server = smtplib.SMTP_SSL(host, port, timeout=30)
        else:
            server = smtplib.SMTP(host, port, timeout=30)
            if settings.EMAIL_USE_TLS:
                server.starttls()
        
        print("✅ Connection established")
        
        # Login
        print(f"Logging in as {username}...")
        server.login(username, password)
        print("✅ Login successful")
        
        # Send test email
        msg = MIMEMultipart()
        msg['From'] = settings.EMAIL_FROM
        msg['To'] = "khristox@gmail.com"
        msg['Subject'] = "Test Email from Action Tracker"
        
        body = "This is a test email to verify SMTP configuration."
        msg.attach(MIMEText(body, 'plain'))
        
        server.send_message(msg)
        print("✅ Test email sent successfully!")
        
        server.quit()
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"❌ Authentication failed: {e}")
        print("   Please check EMAIL_USER and EMAIL_PASSWORD")
    except smtplib.SMTPConnectError as e:
        print(f"❌ Connection failed: {e}")
        print("   Please check EMAIL_HOST and EMAIL_PORT")
    except TimeoutError as e:
        print(f"❌ Connection timeout: {e}")
        print("   The server is not responding. Check if:")
        print("   1. The host is correct")
        print("   2. The port is open (465 for SSL, 587 for TLS)")
        print("   3. Your firewall allows outbound connections")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    # First test raw connection
    asyncio.run(test_simple_email())
    
    # Then test the email service
    asyncio.run(test_email())