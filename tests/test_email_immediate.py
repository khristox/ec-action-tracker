#!/usr/bin/env python3
"""
Test email service with immediate send and debug logging
"""
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Add project root to Python path

import logging

# Set logging level to DEBUG to see everything
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s'
)

from app.services.email_service import email_service
from app.core.config import settings

async def test_email_immediate():
    """Test sending email immediately with debug"""
    
    print("\n" + "=" * 80)
    print(" EMAIL SERVICE DEBUG TEST")
    print("=" * 80)
    
    # Show settings
    print("\n📧 Settings from config:")
    print(f"   EMAIL_HOST: {settings.EMAIL_HOST}")
    print(f"   EMAIL_PORT: {settings.EMAIL_PORT}")
    print(f"   EMAIL_USER: {settings.EMAIL_USER}")
    print(f"   EMAIL_PASSWORD: {'✓ Set' if settings.EMAIL_PASSWORD else '✗ Not set'}")
    print(f"   EMAIL_USE_SSL: {settings.EMAIL_USE_SSL}")
    print(f"   EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
    print(f"   EMAIL_FROM: {settings.EMAIL_FROM}")
    print(f"   EMAIL_FROM_NAME: {settings.EMAIL_FROM_NAME}")
    
    # Get email from user
    to_email = input("\n📧 Enter recipient email address: ").strip()
    if not to_email:
        print("❌ No email address provided")
        return
    
    print(f"\n📧 Sending test email to {to_email}...")
    print("   (Check logs for detailed output)\n")
    
    try:
        # Send immediately (no background tasks)
        result = await email_service.send_verification_email(
            to_email=to_email,
            username="TestUser",
            user_id="test-user-123",
            token="test-token-abc"
        )
        
        if result:
            print("\n✅ Email sent successfully!")
            print(f"   Check your inbox at: {to_email}")
            print("   (Also check spam folder)")
        else:
            print("\n❌ Failed to send email")
            print("   Check the logs above for details")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_email_immediate())