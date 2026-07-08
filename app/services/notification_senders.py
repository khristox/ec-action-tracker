# app/services/notification_senders.py
"""
One sender class per delivery channel, all implementing the same tiny
interface. notification_service picks the right sender from CHANNEL_SENDERS
based on Notification.channel - adding a new channel later means writing
one new class here and registering it, with no changes needed to the model,
CRUD, API, or calling code (auth.py, meetings.py, etc).
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from app.models.notification import NotificationChannel
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


@dataclass
class SendResult:
    success: bool
    error: Optional[str] = None
    provider_message_id: Optional[str] = None


class BaseSender(ABC):
    channel: NotificationChannel
    supports_open_tracking: bool = False

    @abstractmethod
    async def send(self, recipient: str, subject: Optional[str], content: str) -> SendResult:
        ...


class EmailSender(BaseSender):
    channel = NotificationChannel.EMAIL
    supports_open_tracking = True

    async def send(self, recipient: str, subject: Optional[str], content: str) -> SendResult:
        try:
            success = await email_service.send_email(recipient, subject or "", content)
            if success:
                return SendResult(success=True)
            return SendResult(success=False, error="SMTP send failed (see server logs)")
        except Exception as e:
            logger.error(f"❌ EmailSender failed for {recipient}: {e}", exc_info=True)
            return SendResult(success=False, error=str(e))


class SmsSender(BaseSender):
    """
    Stub - not yet wired to a provider. Returns a clean failure so calling
    code and the notification history behave correctly (status=failed,
    readable error) instead of raising. Swap the body for a real provider
    call (e.g. Africa's Talking, Twilio) when ready; the interface below is
    all notification_service needs.
    """
    channel = NotificationChannel.SMS
    supports_open_tracking = False

    async def send(self, recipient: str, subject: Optional[str], content: str) -> SendResult:
        logger.warning(f"SMS channel not yet configured - would send to {recipient}: {content[:80]}")
        return SendResult(success=False, error="SMS channel not yet implemented")


class WhatsAppSender(BaseSender):
    """Stub - same shape as SmsSender. Swap in the WhatsApp Business API / provider SDK when ready."""
    channel = NotificationChannel.WHATSAPP
    supports_open_tracking = False

    async def send(self, recipient: str, subject: Optional[str], content: str) -> SendResult:
        logger.warning(f"WhatsApp channel not yet configured - would send to {recipient}: {content[:80]}")
        return SendResult(success=False, error="WhatsApp channel not yet implemented")


CHANNEL_SENDERS = {
    NotificationChannel.EMAIL: EmailSender(),
    NotificationChannel.SMS: SmsSender(),
    NotificationChannel.WHATSAPP: WhatsAppSender(),
}