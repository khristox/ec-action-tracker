#!/usr/bin/env python3
"""
Test email service functionality
"""
import sys
import os
import asyncio
from pathlib import Path

# Add project root to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

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
        print("   Please check your .env file for EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD")
        return
    
    # Test sending verification email
    print("\n📧 Sending test verification email...")
    background_tasks = BackgroundTasks()
    
    result = await email_service.send_verification_email(
        to_email="khristox@gmail.com",
        username="TestUser",
        user_id="test-user-id-123",
        background_tasks=background_tasks
    )
    
    if result:
        print("✅ Verification email queued successfully!")
    else:
        print("❌ Failed to queue verification email")
    
    # Wait a moment for background tasks
    await asyncio.sleep(3)
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(test_email())