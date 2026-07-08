# app/models/notification.py
import uuid
import enum

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Enum as SAEnum, Integer, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class NotificationChannel(str, enum.Enum):
    EMAIL = "email"
    SMS = "sms"
    WHATSAPP = "whatsapp"


class NotificationStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"


class NotificationCategory(str, enum.Enum):
    AUTH_VERIFICATION = "auth_verification"
    AUTH_WELCOME = "auth_welcome"
    AUTH_PASSWORD_RESET = "auth_password_reset"
    MEETING_NOTIFICATION = "meeting_notification"
    OTHER = "other"


# SQLAlchemy's Enum type binds using the Python enum MEMBER NAME (e.g.
# "EMAIL") by default, not its .value ("email"), unless values_callable is
# given. The Postgres enum types created in the migration only contain the
# lowercase values, so without this every insert fails with:
#   invalid input value for enum notification_channel: "EMAIL"
# This helper is shared by all three enum columns below so the same
# convention is applied consistently.
def _enum_values(enum_cls):
    return [member.value for member in enum_cls]


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    channel = Column(
        SAEnum(
            NotificationChannel,
            name="notification_channel",
            values_callable=_enum_values,
        ),
        nullable=False,
        index=True,
    )

    # user_id covers a known system user; participant_id covers meeting
    # participants who may have no user account. Either, both, or neither
    # may be set depending on what triggered the notification.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    participant_id = Column(UUID(as_uuid=True), ForeignKey("meeting_participants.id", ondelete="SET NULL"), nullable=True, index=True)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True, index=True)

    # Unified recipient address - email address, phone number (E.164 for
    # SMS/WhatsApp), etc. What it means is determined by `channel`.
    recipient = Column(String(255), nullable=False, index=True)
    recipient_name = Column(String(255), nullable=True)

    # subject is email-only (nullable elsewhere); content is the exact
    # rendered body/message sent, for every channel.
    subject = Column(String(500), nullable=True)
    content = Column(Text, nullable=False)

    template_name = Column(String(100), nullable=True)
    category = Column(
        SAEnum(
            NotificationCategory,
            name="notification_category",
            values_callable=_enum_values,
        ),
        nullable=False,
        default=NotificationCategory.OTHER,
        index=True,
    )

    status = Column(
        SAEnum(
            NotificationStatus,
            name="notification_status",
            values_callable=_enum_values,
        ),
        nullable=False,
        default=NotificationStatus.PENDING,
        index=True,
    )
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Open tracking - meaningful for email today (pixel), and reusable for
    # channels with read-receipts later (e.g. WhatsApp delivery webhooks).
    tracking_id = Column(UUID(as_uuid=True), unique=True, default=uuid.uuid4, index=True)
    is_opened = Column(Boolean, nullable=False, default=False)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    open_count = Column(Integer, nullable=False, default=0)

    # Channel-specific provider metadata (e.g. Twilio SID, WhatsApp message
    # ID, SMTP message-id) without needing per-channel columns.
    provider_message_id = Column(String(255), nullable=True)
    extra_data = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<Notification channel={self.channel} to={self.recipient} status={self.status}>"