# routers/meetings/organization.py
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field, field_validator

from app.db.session import get_db
from app.models.meetings.organization import OrganizationNode

# Configure logging
logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class OrganizationNodeBase(BaseModel):
    """Base model for organization node"""
    name: str = Field(..., min_length=2, max_length=200, description="Department/unit name")
    title: str = Field(..., min_length=1, max_length=200, description="Position title")
    parent_id: Optional[str] = Field(None, description="Parent department UUID")
    order: int = Field(0, ge=0, description="Display order")
    email: Optional[str] = Field(None, description="Contact email")
    phone: Optional[str] = Field(None, description="Contact phone")
    department_code: Optional[str] = Field(None, max_length=50, description="Department code")
    location: Optional[str] = Field(None, max_length=200, description="Physical location")
    employee_count: int = Field(0, ge=0, description="Number of employees")
    budget: float = Field(0.0, ge=0, description="Department budget")
    color: str = Field("#4A90E2", pattern=r'^#(?:[0-9a-fA-F]{3}){1,2}$', description="Node color")
    is_active: bool = Field(True, description="Whether node is active")
    
    @field_validator('parent_id', mode='before')
    @classmethod
    def validate_parent_id(cls, v: Any) -> Optional[str]:
        """Validate UUID format for parent_id"""
        if v is None or v == "" or v == "null" or v == "None":
            return None
        try:
            uuid.UUID(str(v))
            return str(v)
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"Invalid UUID format for parent_id: {v}")


class OrganizationNodeCreate(OrganizationNodeBase):
    """Model for creating a new node"""
    additional_metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class OrganizationNodeUpdate(BaseModel):
    """Model for updating a node"""
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    parent_id: Optional[str] = Field(None)
    order: Optional[int] = Field(None, ge=0)
    email: Optional[str] = None
    phone: Optional[str] = None
    department_code: Optional[str] = None
    location: Optional[str] = None
    employee_count: Optional[int] = Field(None, ge=0)
    budget: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, pattern=r'^#(?:[0-9a-fA-F]{3}){1,2}$')
    additional_metadata: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    
    @field_validator('parent_id', mode='before')
    @classmethod
    def validate_parent_id(cls, v: Any) -> Optional[str]:
        """Validate UUID format for parent_id"""
        if v is None or v == "" or v == "null" or v == "None":
            return None
        try:
            uuid.UUID(str(v))
            return str(v)
        except (ValueError, AttributeError, TypeError):
            raise ValueError(f"Invalid UUID format for parent_id: {v}")


class OrganizationNodeResponse(BaseModel):
    """Response model for organization node - uses 'metadata' field for API consistency"""
    id: str
    name: str
    title: str
    parent_id: Optional[str] = None
    level: int
    path: str
    order: int
    is_active: bool
    email: Optional[str] = None
    phone: Optional[str] = None
    department_code: Optional[str] = None
    location: Optional[str] = None
    employee_count: int
    budget: float
    color: str
    display_name: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)  # API uses 'metadata'
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True


class TreeNodeResponse(OrganizationNodeResponse):
    """Response model for tree nodes with children"""
    children: List['TreeNodeResponse'] = []
    
    class Config:
        from_attributes = True


class MoveNodeRequest(BaseModel):
    """Request model for moving nodes"""
    new_parent_id: Optional[str] = None
    new_order: Optional[int] = Field(None, ge=0)


class ReorderChildrenRequest(BaseModel):
    """Request model for reordering children"""
    ordered_ids: List[str]


# Update forward reference
TreeNodeResponse.model_rebuild()


# ==================== Helper Functions ====================

def node_to_response(node) -> OrganizationNodeResponse:
    """Convert SQLAlchemy node to response model"""
    # Build metadata dictionary from node fields
    metadata_dict = {
        "email": node.email,
        "phone": node.phone,
        "department_code": node.department_code,
        "location": node.location,
        "employee_count": node.employee_count,
        "budget": node.budget,
        "color": node.color,
    }
    
    # Add additional_metadata if it exists
    if hasattr(node, 'additional_metadata') and node.additional_metadata:
        metadata_dict["additional"] = node.additional_metadata
    
    return OrganizationNodeResponse(
        id=str(node.id),
        name=node.name,
        title=node.title,
        parent_id=str(node.parent_id) if node.parent_id else None,
        level=node.level,
        path=node.path,
        order=node.order,
        is_active=node.is_active,
        email=node.email,
        phone=node.phone,
        department_code=node.department_code,
        location=node.location,
        employee_count=node.employee_count,
        budget=node.budget,
        color=node.color,
        display_name=getattr(node, 'display_name', node.name),
        metadata=metadata_dict,  # Use the built metadata dict
        created_at=node.created_at.isoformat() if hasattr(node, 'created_at') and node.created_at else None,
        updated_at=node.updated_at.isoformat() if hasattr(node, 'updated_at') and node.updated_at else None
    )


# ==================== Router ====================

router = APIRouter()
router_departments = APIRouter()

@router.get("/", response_model=List[OrganizationNodeResponse])
@router_departments.get("/", response_model=List[OrganizationNodeResponse])
async def get_organization_nodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(True, description="Filter by active status. Defaults to True (active only)"),
    parent_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None, min_length=1, description="Search by name or code"),
    search_fields: Optional[str] = Query("name,code", description="Comma-separated fields to search in (name, code, description)"),
    db: AsyncSession = Depends(get_db)
):
    """Get all organization nodes with optional filtering.
    
    By default, only active nodes are returned. Set is_active=None to get all nodes.
    Search supports partial matching on specified fields.
    """
    try:
        query = select(OrganizationNode)
        
        # Default to active nodes only
        if is_active is not None:
            query = query.where(OrganizationNode.is_active == is_active)
        else:
            # When is_active is explicitly None, return all (no filter)
            pass
        
        if parent_id is not None:
            # Validate UUID format
            try:
                uuid.UUID(parent_id)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid UUID format: {parent_id}")
            query = query.where(OrganizationNode.parent_id == parent_id)
        
        # Search functionality
        if search:
            search_term = f"%{search}%"
            search_conditions = []
            
            # Parse search fields
            fields = [field.strip() for field in search_fields.split(",") if field.strip()]
            
            # Build search conditions based on available fields
            if "name" in fields:
                search_conditions.append(OrganizationNode.name.ilike(search_term))
            if "code" in fields:
                search_conditions.append(OrganizationNode.code.ilike(search_term))
            if "description" in fields:
                if hasattr(OrganizationNode, 'description'):  # Check if field exists
                    search_conditions.append(OrganizationNode.description.ilike(search_term))
            
            if search_conditions:
                from sqlalchemy import or_
                query = query.where(or_(*search_conditions))
        
        query = query.offset(skip).limit(limit).order_by(OrganizationNode.order, OrganizationNode.name)
        
        result = await db.execute(query)
        nodes = result.scalars().all()
        
        return [node_to_response(node) for node in nodes]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_organization_nodes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    

@router.get("/{node_id}", response_model=OrganizationNodeResponse)
async def get_organization_node(
    node_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific organization node by ID"""
    try:
        # Validate UUID format
        try:
            uuid.UUID(node_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid UUID format: {node_id}")
        
        query = select(OrganizationNode).where(OrganizationNode.id == node_id)
        result = await db.execute(query)
        node = result.scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Organization node not found")
        
        return node_to_response(node)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_organization_node: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/", response_model=OrganizationNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_organization_node(
    node_data: OrganizationNodeCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new organization node"""
    try:
        # Check if parent exists if parent_id is provided
        if node_data.parent_id:
            parent_query = select(OrganizationNode).where(OrganizationNode.id == node_data.parent_id)
            result = await db.execute(parent_query)
            parent = result.scalar_one_or_none()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent node not found")
        
        # Create new node
        new_node = OrganizationNode(
            name=node_data.name,
            title=node_data.title,
            parent_id=node_data.parent_id,
            order=node_data.order,
            email=node_data.email,
            phone=node_data.phone,
            department_code=node_data.department_code,
            location=node_data.location,
            employee_count=node_data.employee_count,
            budget=node_data.budget,
            color=node_data.color,
            is_active=node_data.is_active,
            additional_metadata=node_data.additional_metadata
        )
        
        db.add(new_node)
        await db.commit()
        await db.refresh(new_node)
        
        return node_to_response(new_node)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in create_organization_node: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")