# app/schemas/__init__.py

from app.schemas.user import (
    UserBase,
    UserCreate,
    UserUpdate,
    UserResponse,
    UserWithRoles
)
from app.schemas.role import (
    RoleBase,
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleWithPermissions
)
from app.schemas.permission import (
    PermissionBase,
    PermissionCreate,
    PermissionUpdate,
    PermissionResponse
)

# Action Tracker Schemas
from app.schemas.action_tracker import (
    # Participant Schemas
    ParticipantBase,
    ParticipantCreate,
    ParticipantUpdate,
    ParticipantResponse,
    
    # Participant List Schemas
    ParticipantListBase,
    ParticipantListCreate,
    ParticipantListUpdate,
    ParticipantListResponse,
    
    # Meeting Participant Schemas
    MeetingParticipantBase,
    MeetingParticipantCreate,
    MeetingParticipantResponse,
    
    # Meeting Schemas
    MeetingBase,
    MeetingCreate,
    MeetingUpdate,
    MeetingResponse,
    
    # Meeting Minutes Schemas
    MeetingMinutesBase,
    MeetingMinutesCreate,
    MeetingMinutesUpdate,
    MeetingMinutesResponse,
    
    # Meeting Action Schemas
    MeetingActionBase,
    MeetingActionCreate,
    MeetingActionUpdate,
    MeetingActionResponse,
    
    # Action Status History Schemas
    ActionStatusHistoryBase,
    ActionStatusHistoryCreate,
    ActionStatusHistoryResponse,
    
    # Action Progress Update Schema
    ActionProgressUpdate,
    
    # Action Comment Schemas
    ActionCommentBase,
    ActionCommentCreate,
    ActionCommentResponse,
    
    # Meeting Document Schemas
    MeetingDocumentBase,
    MeetingDocumentCreate,
    MeetingDocumentUpdate,
    MeetingDocumentResponse,
    
    # Dashboard Summary Schemas
    MeetingSummary,
    ActionSummary,
    MyTaskResponse,
)

__all__ = [
    # User schemas
    'UserBase',
    'UserCreate',
    'UserUpdate',
    'UserResponse',
    'UserWithRoles',
    
    # Role schemas
    'RoleBase',
    'RoleCreate',
    'RoleUpdate',
    'RoleResponse',
    'RoleWithPermissions',
    
    # Permission schemas
    'PermissionBase',
    'PermissionCreate',
    'PermissionUpdate',
    'PermissionResponse',
    
    # Action Tracker - Participant Schemas
    'ParticipantBase',
    'ParticipantCreate',
    'ParticipantUpdate',
    'ParticipantResponse',
    
    # Action Tracker - Participant List Schemas
    'ParticipantListBase',
    'ParticipantListCreate',
    'ParticipantListUpdate',
    'ParticipantListResponse',
    
    # Action Tracker - Meeting Participant Schemas
    'MeetingParticipantBase',
    'MeetingParticipantCreate',
    'MeetingParticipantResponse',
    
    # Action Tracker - Meeting Schemas
    'MeetingBase',
    'MeetingCreate',
    'MeetingUpdate',
    'MeetingResponse',
    
    # Action Tracker - Meeting Minutes Schemas
    'MeetingMinutesBase',
    'MeetingMinutesCreate',
    'MeetingMinutesUpdate',
    'MeetingMinutesResponse',
    
    # Action Tracker - Meeting Action Schemas
    'MeetingActionBase',
    'MeetingActionCreate',
    'MeetingActionUpdate',
    'MeetingActionResponse',
    
    # Action Tracker - Action Status History Schemas
    'ActionStatusHistoryBase',
    'ActionStatusHistoryCreate',
    'ActionStatusHistoryResponse',
    
    # Action Tracker - Action Progress Update Schema
    'ActionProgressUpdate',
    
    # Action Tracker - Action Comment Schemas
    'ActionCommentBase',
    'ActionCommentCreate',
    'ActionCommentResponse',
    
    # Action Tracker - Meeting Document Schemas
    'MeetingDocumentBase',
    'MeetingDocumentCreate',
    'MeetingDocumentUpdate',
    'MeetingDocumentResponse',
    
    # Action Tracker - Dashboard Summary Schemas
    'MeetingSummary',
    'ActionSummary',
    'MyTaskResponse',
]