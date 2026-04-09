# app/schemas/action_tracker_participants.py
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime

# ==================== Shared Config ====================

class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ==================== Participant Schemas ====================

class ParticipantBase(ORMBase):
    name: str
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None


class ParticipantCreate(ParticipantBase):
    pass


class ParticipantUpdate(ORMBase):
    name: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    title: Optional[str] = None
    organization: Optional[str] = None
    notes: Optional[str] = None


class ParticipantResponse(ParticipantBase):
    id: UUID
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


# ==================== Paginated Response ====================

class PaginatedParticipantResponse(BaseModel):
    """Paginated response for participants list"""
    items: List[ParticipantResponse]
    total: int
    page: int
    size: int
    pages: int
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Bulk Create ====================

class ParticipantBulkCreate(BaseModel):
    """Schema for bulk creating participants"""
    participants: List[ParticipantCreate]
    
    model_config = ConfigDict(from_attributes=True)


# ==================== Participant List (Group) Schemas ====================

class ParticipantListBase(ORMBase):
    name: str
    description: Optional[str] = None
    is_global: bool = False


class ParticipantListCreate(ParticipantListBase):
    participant_ids: List[UUID] = []


class ParticipantListUpdate(ORMBase):
    name: Optional[str] = None
    description: Optional[str] = None
    is_global: Optional[bool] = None
    participant_ids: Optional[List[UUID]] = None


class ParticipantListResponse(ParticipantListBase):
    id: UUID
    created_by_id: Optional[UUID] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_by_id: Optional[UUID] = None
    updated_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True
    participants: List[ParticipantResponse] = []
    participant_count: int = 0