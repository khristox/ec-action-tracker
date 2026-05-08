# models/meetings/organization.py
from pydantic import BaseModel, Field  # Change this import
from typing import Optional, List, Dict, Any
from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean, JSON, Text
from sqlalchemy.orm import relationship, validates

from app.db.base import Base
from app.models.base import BaseModel as BaseModelMixin  # Rename to avoid confusion with pydantic's BaseModel

class OrganizationNode(Base):
    __tablename__ = 'organization_nodes'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    title = Column(String(200), nullable=False)
    parent_id = Column(Integer, ForeignKey('organization_nodes.id', ondelete='CASCADE'), nullable=True)
    level = Column(Integer, default=0)
    path = Column(String(1000), default='')
    order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Metadata fields
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    department_code = Column(String(50), nullable=True)
    location = Column(String(200), nullable=True)
    employee_count = Column(Integer, default=0)
    budget = Column(Float, default=0.0)
    color = Column(String(20), default='#4A90E2')
    additional_metadata = Column(JSON, default={})
    
    # Relationships
    parent = relationship('OrganizationNode', remote_side=[id], backref='children', foreign_keys=[parent_id])
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_path_and_level()
    
    def _update_path_and_level(self):
        """Update path and level based on parent"""
        if self.parent_id:
            parent = None  # This will be set after session query
            self.level = self.parent.level + 1 if self.parent else 0
            self.path = f"{self.parent.path}/{self.id}" if self.parent else f"/{self.id}"
        else:
            self.level = 0
            self.path = f"/{self.id}"
    
    def to_dict(self, include_children: bool = False):
        """Convert node to dictionary"""
        data = {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'parent_id': self.parent_id,
            'level': self.level,
            'path': self.path,
            'order': self.order,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'metadata': {
                'email': self.email,
                'phone': self.phone,
                'department_code': self.department_code,
                'location': self.location,
                'employee_count': self.employee_count,
                'budget': self.budget,
                'color': self.color,
                'additional': self.additional_metadata
            }
        }
        
        if include_children and hasattr(self, 'children') and self.children:
            data['children'] = [child.to_dict(include_children=True) for child in self.children if child.is_active]
        
        return data
    
    def __repr__(self):
        return f"<OrganizationNode {self.name} (Level {self.level})>"

# Pydantic Models for API
class OrganizationNodeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    title: str = Field(..., min_length=1, max_length=200)
    parent_id: Optional[int] = None
    order: int = 0
    email: Optional[str] = None
    phone: Optional[str] = None
    department_code: Optional[str] = None
    location: Optional[str] = None
    employee_count: int = 0
    budget: float = 0.0
    color: str = "#4A90E2"
    additional_metadata: Dict[str, Any] = Field(default_factory=dict)

class OrganizationNodeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    parent_id: Optional[int] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department_code: Optional[str] = None
    location: Optional[str] = None
    employee_count: Optional[int] = None
    budget: Optional[float] = None
    color: Optional[str] = None
    additional_metadata: Optional[Dict[str, Any]] = None

class OrganizationNodeResponse(BaseModel):
    id: int
    name: str
    title: str
    parent_id: Optional[int]
    level: int
    path: str
    order: int
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]
    metadata: Dict[str, Any]
    children: Optional[List['OrganizationNodeResponse']] = None
    
    class Config:
        orm_mode = True

class MoveNodeRequest(BaseModel):
    new_parent_id: Optional[int] = None
    new_order: Optional[int] = None

class ReorderChildrenRequest(BaseModel):
    ordered_ids: List[int]

# Forward reference for Pydantic
OrganizationNodeResponse.update_forward_refs()