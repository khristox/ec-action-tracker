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
from app.models.menu import Menu
from app.models.role import RoleMenuPermission

from app.models.meetings.organization import OrganizationNode
from app.models.meetings.user_department import (
    UserDepartment,
    UserDepartmentRole,
    UserDepartmentStatus,
)

from app.models.meetings.action_tracker import (
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

from app.models.meetings.recurring_meeting import (
    RecurringMeeting,
    RecurringMeetingOccurrence,
)

from app.models.meetings.meeting_recording import MeetingRecording
from app.models.chart_data import ChartConfiguration, ChartDataCache
from app.models.token_blacklist import TokenBlacklist

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
    'Menu',
    'RoleMenuPermission',
    'OrganizationNode',
    'UserDepartment',
    'UserDepartmentRole',
    'UserDepartmentStatus',
    "Participant",
    "ParticipantList",
    "Meeting",
    "MeetingParticipant",
    "MeetingMinutes",
    "MeetingAction",
    "ActionStatusHistory",
    "ActionComment",
    "MeetingDocument",
    "RecurringMeeting",
    "RecurringMeetingOccurrence",
    "MeetingRecording",
    "ChartConfiguration",
    "ChartDataCache",
    "TokenBlacklist",
]