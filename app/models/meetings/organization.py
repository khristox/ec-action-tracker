# models/meetings/organization.py
"""
Organization Node Model with UUID Support
Provides hierarchical tree structure for departments and teams
"""

import uuid
import re
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from sqlalchemy import Column, String, ForeignKey, DateTime, Float, Boolean, JSON, Integer, Index
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property

from app.db.base import Base


# ==================== Helper Functions ====================

def generate_uuid() -> str:
    """Generate a UUID string"""
    return str(uuid.uuid4())

def validate_uuid(value: Optional[str], field_name: str = "id") -> Optional[str]:
    """Validate UUID format"""
    if value is None or value == "" or value == "null":
        return None
    try:
        uuid.UUID(str(value))
        return str(value)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid UUID format for {field_name}: {value}")


# ==================== SQLAlchemy Model ====================

class OrganizationNode(Base):
    """Organization hierarchy node model"""
    __tablename__ = 'organization_nodes'
    __table_args__ = (
        Index('idx_org_parent_id', 'parent_id'),
        Index('idx_org_path', 'path'),
        Index('idx_org_level_order', 'level', 'order'),
        Index('idx_org_is_active', 'is_active'),
        Index('idx_org_department_code', 'department_code'),
        {'mysql_engine': 'InnoDB', 'mysql_charset': 'utf8mb4'}
    )
    
    # Primary Key
    id = Column(String(36), primary_key=True, default=generate_uuid, nullable=False)
    
    # Basic Information
    name = Column(String(200), nullable=False)
    title = Column(String(200), nullable=False)
    parent_id = Column(String(36), ForeignKey('organization_nodes.id', ondelete='CASCADE'), nullable=True)
    
    # Hierarchy Information
    level = Column(Integer, default=0, nullable=False)
    path = Column(String(1000), default='', nullable=False)
    order = Column(Integer, default=0, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Contact Information
    email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    
    # Location & Identification
    department_code = Column(String(50), nullable=True, unique=True)
    location = Column(String(200), nullable=True)
    
    # Statistics
    employee_count = Column(Integer, default=0, nullable=False)
    budget = Column(Float, default=0.0, nullable=False)
    
    # Visual Customization
    color = Column(String(20), default='#4A90E2', nullable=False)
    
    # Flexible Metadata
    additional_metadata = Column(JSON, default=dict, nullable=False)
    
    # ==================== RELATIONSHIPS ====================
    
    # Hierarchical relationship
    parent = relationship(
        'OrganizationNode',
        remote_side=[id],
        backref='children',
        foreign_keys=[parent_id]
    )
    
    # Relationship to UserDepartment - ADD overlaps
    user_departments = relationship(
        "UserDepartment",
        back_populates="department",
        cascade="all, delete-orphan",
        lazy="selectin",
        foreign_keys="UserDepartment.department_id",
        overlaps="assigned_users,departments"  # add 'departments'
    )

    assigned_users = relationship(
        "User",
        secondary="user_departments",
        primaryjoin="OrganizationNode.id == UserDepartment.department_id",
        secondaryjoin="UserDepartment.user_id == User.id",
        viewonly=True,
        lazy="selectin",
        overlaps="user_departments,departments"  # add 'departments'
    )
    
    def __init__(self, **kwargs):
        if 'id' not in kwargs:
            kwargs['id'] = generate_uuid()
        super().__init__(**kwargs)
    
    @validates('email')
    def validate_email(self, key, email):
        """Validate email format"""
        if email:
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(pattern, email):
                raise ValueError(f"Invalid email format: {email}")
        return email
    
    @validates('color')
    def validate_color(self, key, color):
        """Validate hex color format"""
        if color:
            pattern = r'^#(?:[0-9a-fA-F]{3}){1,2}$'
            if not re.match(pattern, color):
                raise ValueError(f"Invalid color format: {color}. Use hex format like #4A90E2")
        return color
    
    def _update_path_and_level(self):
        """Update path and level based on parent"""
        if self.parent_id:
            self.level = 0  # Will be updated after parent is set
            self.path = f"/{self.id}"
        else:
            self.level = 0
            self.path = f"/{self.id}"
    
    def update_path_and_level_with_parent(self, parent_node):
        """Update path and level with a loaded parent node"""
        if parent_node:
            self.level = parent_node.level + 1
            self.path = f"{parent_node.path}/{self.id}"
        else:
            self.level = 0
            self.path = f"/{self.id}"
    
    @hybrid_property
    def display_name(self) -> str:
        """Get display name with department code if available"""
        if self.department_code:
            return f"{self.name} ({self.department_code})"
        return self.name
    
    @property
    def active_users(self) -> List:
        """Get active users assigned to this department"""
        from app.models.meetings.user_department import UserDepartmentStatus
        return [
            ud.user for ud in self.user_departments 
            if ud.status == UserDepartmentStatus.ACTIVE and 
            (ud.end_date is None or ud.end_date > datetime.utcnow())
        ]
    
    @property
    def department_head(self) -> Optional['User']:
        """Get the department head user"""
        from app.models.meetings.user_department import UserDepartmentRole, UserDepartmentStatus
        for ud in self.user_departments:
            if (ud.role == UserDepartmentRole.HEAD and 
                ud.status == UserDepartmentStatus.ACTIVE and
                (ud.end_date is None or ud.end_date > datetime.utcnow())):
                return ud.user
        return None
    
    @property
    def managers(self) -> List['User']:
        """Get all managers of this department"""
        from app.models.meetings.user_department import UserDepartmentRole, UserDepartmentStatus
        return [
            ud.user for ud in self.user_departments 
            if ud.role == UserDepartmentRole.MANAGER and 
            ud.status == UserDepartmentStatus.ACTIVE and
            (ud.end_date is None or ud.end_date > datetime.utcnow())
        ]
    
    @property
    def user_count(self) -> int:
        """Get total number of active users in this department"""
        return len(self.active_users)
    
    def to_dict(self, include_children: bool = False, depth: int = 0, max_depth: Optional[int] = None, include_users: bool = False) -> Dict[str, Any]:
        """
        Convert node to dictionary with optional recursive children
        
        Args:
            include_children: Whether to include child nodes
            depth: Current depth (for recursion)
            max_depth: Maximum depth to traverse
            include_users: Whether to include assigned users
        """
        # Check depth limit
        if max_depth is not None and depth >= max_depth:
            return self._to_dict_base(truncated=True)
        
        data = self._to_dict_base()
        
        if include_users:
            data['users'] = [
                {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': user.full_name
                }
                for user in self.active_users
            ]
            data['user_count'] = self.user_count
            data['department_head'] = self.department_head.id if self.department_head else None
        
        if include_children and hasattr(self, 'children') and self.children:
            data['children'] = []
            for child in self.children:
                if child.is_active:
                    data['children'].append(
                        child.to_dict(include_children=True, depth=depth + 1, max_depth=max_depth, include_users=include_users)
                    )
        
        return data
    
    def _to_dict_base(self, truncated: bool = False) -> Dict[str, Any]:
        """Base dictionary conversion without children"""
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
            'email': self.email,
            'phone': self.phone,
            'department_code': self.department_code,
            'location': self.location,
            'employee_count': self.employee_count,
            'budget': self.budget,
            'color': self.color,
            'display_name': self.display_name,
            'additional_metadata': self.additional_metadata
        }
        
        if truncated:
            data['truncated'] = True
        
        return data
    
    def __repr__(self) -> str:
        return f"<OrganizationNode(id={self.id}, name={self.name}, level={self.level})>"


# ==================== Pydantic Models for API ====================

class DepartmentRole(str, Enum):
    """Department role types"""
    HEAD = "head"
    MANAGER = "manager"
    SUPERVISOR = "supervisor"
    MEMBER = "member"
    TEMPORARY = "temporary"
    CONTRACTOR = "contractor"


class OrganizationNodeBase(BaseModel):
    """Base schema for organization node"""
    model_config = ConfigDict(from_attributes=True)
    
    name: str = Field(..., min_length=2, max_length=200, description="Department/team name")
    title: str = Field(..., min_length=1, max_length=200, description="Position title")
    parent_id: Optional[str] = Field(None, description="Parent department UUID")
    order: int = Field(0, ge=0, description="Display order among siblings")
    email: Optional[str] = Field(None, description="Contact email")
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s-]{10,}$', description="Contact phone")
    department_code: Optional[str] = Field(None, max_length=50, description="Unique department code")
    location: Optional[str] = Field(None, max_length=200, description="Office location")
    employee_count: int = Field(0, ge=0, description="Number of employees")
    budget: float = Field(0.0, ge=0, description="Annual budget in USD")
    color: str = Field("#4A90E2", pattern=r'^#(?:[0-9a-fA-F]{3}){1,2}$', description="Node color for visualization")
    additional_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    
    @field_validator('parent_id', mode='before')
    @classmethod
    def validate_parent_id(cls, v: Any) -> Optional[str]:
        """Validate UUID format for parent_id"""
        return validate_uuid(v, "parent_id")
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format"""
        if v:
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(pattern, v):
                raise ValueError(f"Invalid email format: {v}")
        return v


class OrganizationNodeCreate(OrganizationNodeBase):
    """Schema for creating a new organization node"""
    pass


class OrganizationNodeUpdate(BaseModel):
    """Schema for updating an organization node"""
    model_config = ConfigDict(from_attributes=True)
    
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    parent_id: Optional[str] = Field(None)
    order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    email: Optional[str] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[\d\s-]{10,}$')
    department_code: Optional[str] = Field(None, max_length=50)
    location: Optional[str] = Field(None, max_length=200)
    employee_count: Optional[int] = Field(None, ge=0)
    budget: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r'^#(?:[0-9a-fA-F]{3}){1,2}$')
    additional_metadata: Optional[Dict[str, Any]] = None
    
    @field_validator('parent_id', mode='before')
    @classmethod
    def validate_parent_id(cls, v: Any) -> Optional[str]:
        """Validate UUID format for parent_id"""
        return validate_uuid(v, "parent_id")
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format"""
        if v:
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(pattern, v):
                raise ValueError(f"Invalid email format: {v}")
        return v
    
    @model_validator(mode='after')
    def validate_at_least_one_field(self) -> 'OrganizationNodeUpdate':
        """Ensure at least one field is provided for update"""
        if not any([self.name, self.title, self.parent_id is not None, self.order is not None,
                   self.is_active is not None, self.email, self.phone, self.department_code,
                   self.location, self.employee_count is not None, self.budget is not None,
                   self.color, self.additional_metadata]):
            raise ValueError("At least one field must be provided for update")
        return self


class OrganizationNodeResponse(OrganizationNodeBase):
    """Schema for organization node response"""
    id: str
    level: int
    path: str
    is_active: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    children: Optional[List['OrganizationNodeResponse']] = Field(default_factory=list, description="Child nodes")
    
    @field_validator('id', mode='before')
    @classmethod
    def validate_id(cls, v: Any) -> str:
        """Validate and convert ID to string"""
        return str(v)


class TreeNodeResponse(OrganizationNodeResponse):
    """Schema for tree node response with depth control"""
    truncated: Optional[bool] = Field(False, description="Indicates if children were truncated due to depth limit")


class MoveNodeRequest(BaseModel):
    """Schema for moving a node to a different parent"""
    new_parent_id: Optional[str] = Field(None, description="New parent department UUID")
    new_order: Optional[int] = Field(None, ge=0, description="New display order")
    
    @field_validator('new_parent_id', mode='before')
    @classmethod
    def validate_new_parent_id(cls, v: Any) -> Optional[str]:
        """Validate UUID format for new_parent_id"""
        return validate_uuid(v, "new_parent_id")


class ReorderChildrenRequest(BaseModel):
    """Schema for reordering child nodes"""
    ordered_ids: List[str] = Field(..., min_length=1, description="List of child node UUIDs in desired order")
    
    @field_validator('ordered_ids')
    @classmethod
    def validate_ordered_ids(cls, v: List[str]) -> List[str]:
        """Validate all IDs are valid UUIDs and unique"""
        if not v:
            raise ValueError("ordered_ids cannot be empty")
        
        # Check for duplicates
        if len(v) != len(set(v)):
            raise ValueError("ordered_ids contains duplicate IDs")
        
        # Validate each ID
        for item in v:
            validate_uuid(item, "ordered_id")
        
        return v


class BulkCreateNodesRequest(BaseModel):
    """Schema for bulk creating nodes"""
    nodes: List[OrganizationNodeCreate] = Field(..., min_length=1, max_length=100)
    
    @field_validator('nodes')
    @classmethod
    def validate_bulk_size(cls, v: List[OrganizationNodeCreate]) -> List[OrganizationNodeCreate]:
        """Validate bulk operation size"""
        if len(v) > 100:
            raise ValueError("Maximum 100 nodes per bulk operation")
        return v


class OrganizationSummaryResponse(BaseModel):
    """Schema for organization summary statistics"""
    total_nodes: int
    root_nodes_count: int
    max_depth: int
    nodes_by_level: Dict[int, int]
    total_employees: int
    total_budget: float
    average_employees_per_node: float


class NodePathResponse(BaseModel):
    """Schema for node path response"""
    node_id: str
    node_name: str
    path: List[Dict[str, Any]]
    depth: int


# Update forward references
OrganizationNodeResponse.model_rebuild()
TreeNodeResponse.model_rebuild()