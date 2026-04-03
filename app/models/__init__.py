"""
Model imports - ensures all models are registered with SQLAlchemy
"""

from app.db.base import Base

# No dependencies
from app.models.user import User, user_roles
from app.models.role import Role, Permission, role_permissions
from app.models.user_attribute import UserAttribute
from app.models.audit import AuditLog
from app.models.refresh_token import RefreshToken
from app.models.general.dynamic_attribute import (
    AttributeGroup,
    Attribute,
    AttributeValue,
    EntityAttribute
)
from app.models.address.location import Location

# Then import action tracker models
from app.models.action_tracker import (
    Participant,
    ParticipantList,
    Meeting,
    MeetingParticipant,
    MeetingMinutes,
    MeetingAction,
    ActionStatusHistory,
    ActionComment,
    MeetingDocument
)

__all__ = [
    'Base',
    'User',
    'UserAttribute',
    'user_roles',
    'Role',
    'Permission',
    'role_permissions',
    'AuditLog',
    'RefreshToken',
    'AttributeGroup',
    'Attribute',
    'AttributeValue',
    'EntityAttribute',
    'Location',
    "Participant",
    "ParticipantList",
    "Meeting",
    "MeetingParticipant",
    "MeetingMinutes",
    "MeetingAction",
    "ActionStatusHistory",
    "ActionComment",
    "MeetingDocument"
]