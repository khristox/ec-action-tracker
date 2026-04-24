# app/services/resend_api.py - Using Resend HTTP API

import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class ResendAPIService:
    def __init__(self):
        self.api_key = getattr(settings, 'EMAIL_PASSWORD', None)  # Your re_ key
        self.from_email = getattr(settings, 'EMAIL_FROM', None)
        self.from_name = getattr(settings, 'EMAIL_FROM_NAME', 'Action Tracker')
        self.base_url = "https://api.resend.com"
        
        self.is_configured = bool(self.api_key and self.from_email)
    
    async def send_verification_email(self, to_email: str, token: str, username: str) -> bool:
        """Send email using Resend HTTP API"""
        if not self.is_configured:
            logger.error("Resend API not configured")
            return False
        
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:8001')
        verification_url = f"{frontend_url}/verify-email?token={token}"
        
        html_content = f"""
        <h2>Welcome to {self.from_name}!</h2>
        <p>Hello {username},</p>
        <p>Please verify your email: <a href="{verification_url}">Click here</a></p>
        <p>Or visit: {verification_url}</p>
        <p>This link expires in 24 hours.</p>
        """
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": f"{self.from_name} <{self.from_email}>",
                    "to": [to_email],
                    "subject": f"Verify your email - {self.from_name}",
                    "html": html_content,
                }
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Email sent via Resend API to {to_email}")
                return True
            else:
                logger.error(f"❌ Resend API error: {response.text}")
                return False


resend_service = ResendAPIService()