# routers/meetings/organization.py
from sqlalchemy import select 

from app.models.meetings.organization import OrganizationNode
from app.schemas.organization import OrganizationNodeCreate, OrganizationNodeResponse, OrganizationNodeUpdate, TreeNodeResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any, Union
from app.db.session import get_db
from app.crud.meetings.organization import OrganizationCRUD
from datetime import datetime
import uuid


# ==================== Router ====================

router = APIRouter()
router_departments = APIRouter()


@router.get("/tree", response_model=List[TreeNodeResponse])
async def get_organization_tree(
    root_id: Optional[str] = Query(None, description="Root node UUID"),  # Changed to str
    db: AsyncSession = Depends(get_db)
):
    """Get organization tree structure"""
    try:
        crud = OrganizationCRUD(db)
        tree_data = await crud.get_tree(root_id)
        
        # Convert to response models
        def convert_to_response(node_dict: Dict) -> TreeNodeResponse:
            children = [convert_to_response(child) for child in node_dict.get('children', [])]
            return TreeNodeResponse(
                id=str(node_dict['id']),
                name=node_dict['name'],
                title=node_dict['title'],
                parent_id=str(node_dict.get('parent_id')) if node_dict.get('parent_id') else None,
                level=node_dict.get('level', 0),
                path=node_dict.get('path', ''),
                order=node_dict.get('order', 0),
                is_active=node_dict.get('is_active', True),
                email=node_dict.get('email'),
                phone=node_dict.get('phone'),
                department_code=node_dict.get('department_code'),
                location=node_dict.get('location'),
                employee_count=node_dict.get('employee_count', 0),
                budget=node_dict.get('budget', 0.0),
                color=node_dict.get('color', '#4A90E2'),
                created_at=node_dict.get('created_at'),
                updated_at=node_dict.get('updated_at'),
                children=children
            )
        
        result = [convert_to_response(node) for node in tree_data]
        return result
    except Exception as e:
        print(f"Error in get_organization_tree: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/nodes", response_model=List[OrganizationNodeResponse])
async def get_all_nodes(
    include_inactive: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """Get all nodes as flat list"""
    try:
        crud = OrganizationCRUD(db)
        nodes = await crud.get_all_nodes(include_inactive=include_inactive, skip=skip, limit=limit)
        
        return [
            OrganizationNodeResponse(
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
                created_at=node.created_at.isoformat() if node.created_at else None,
                updated_at=node.updated_at.isoformat() if node.updated_at else None
            )
            for node in nodes
        ]
    except Exception as e:
        print(f"Error in get_all_nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/roots", response_model=List[OrganizationNodeResponse])
async def get_root_nodes(db: AsyncSession = Depends(get_db)):
    """Get all root nodes"""
    try:
        crud = OrganizationCRUD(db)
        nodes = await crud.get_root_nodes()
        
        return [
            OrganizationNodeResponse(
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
                created_at=node.created_at.isoformat() if node.created_at else None,
                updated_at=node.updated_at.isoformat() if node.updated_at else None
            )
            for node in nodes
        ]
    except Exception as e:
        print(f"Error in get_root_nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/nodes/{node_id}", response_model=OrganizationNodeResponse)
async def get_node(
    node_id: str,  # Changed to str
    db: AsyncSession = Depends(get_db)
):
    """Get a specific node"""
    try:
        crud = OrganizationCRUD(db)
        node = await crud.get_node(node_id)
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/nodes", response_model=OrganizationNodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(
    node_data: OrganizationNodeCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new organization node"""
    try:
        crud = OrganizationCRUD(db)
        node = await crud.create_node(node_data.dict())
        
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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in create_node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/nodes/{node_id}", response_model=OrganizationNodeResponse)
async def update_node(
    node_id: str,  # Changed to str
    node_data: OrganizationNodeUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a node"""
    try:
        crud = OrganizationCRUD(db)
        node = await crud.update_node(node_id, node_data.dict(exclude_unset=True))
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: str,  # Changed to str
    soft_delete: bool = Query(True),
    db: AsyncSession = Depends(get_db)
):
    """Delete a node"""
    try:
        crud = OrganizationCRUD(db)
        
        if soft_delete:
            success = await crud.soft_delete_node(node_id)
        else:
            success = await crud.hard_delete_node(node_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Node not found")
        
        return {"message": "Node deleted successfully", "success": True}
    except Exception as e:
        print(f"Error in delete_node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/nodes/{node_id}/move", response_model=OrganizationNodeResponse)
async def move_node(
    node_id: str,  # Changed to str
    new_parent_id: Optional[str] = Query(None, description="New parent department UUID"),
    new_order: Optional[int] = Query(None, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """Move node to new parent"""
    try:
        crud = OrganizationCRUD(db)
        node = await crud.move_node(node_id, new_parent_id, new_order)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in move_node: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search", response_model=List[OrganizationNodeResponse])
async def search_nodes(
    q: str = Query(..., min_length=2, description="Search term"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Search nodes by name, title, or department code"""
    try:
        crud = OrganizationCRUD(db)
        nodes = await crud.search_nodes(q, limit)
        
        return [
            OrganizationNodeResponse(
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
                created_at=node.created_at.isoformat() if node.created_at else None,
                updated_at=node.updated_at.isoformat() if node.updated_at else None
            )
            for node in nodes
        ]
    except Exception as e:
        print(f"Error in search_nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/", response_model=List[OrganizationNodeResponse])
@router_departments.get("", response_model=List[OrganizationNodeResponse])
async def get_organization_nodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None),
    parent_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Get all organization nodes with optional filtering"""
    query = select(OrganizationNode)

    if is_active is not None:
        query = query.where(OrganizationNode.is_active == is_active)

    if parent_id is not None:
        query = query.where(OrganizationNode.parent_id == parent_id)

    query = query.offset(skip).limit(limit).order_by(OrganizationNode.order, OrganizationNode.name)

    result = await db.execute(query)
    nodes = result.scalars().all()

    return [
        OrganizationNodeResponse(
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
            created_at=node.created_at.isoformat() if node.created_at else None,
            updated_at=node.updated_at.isoformat() if node.updated_at else None
        )
        for node in nodes
    ]

@router.get("/{node_id}", response_model=OrganizationNodeResponse)
@router_departments.get("/{node_id}", response_model=OrganizationNodeResponse)
async def get_organization_node(
    node_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific organization node by ID"""
    query = select(OrganizationNode).where(OrganizationNode.id == node_id)
    result = await db.execute(query)
    node = result.scalar_one_or_none()
    
    if not node:
        raise HTTPException(status_code=404, detail="Organization node not found")
    
    return node.to_dict()

@router.get("/{node_id}/ancestors", response_model=List[OrganizationNodeResponse])
@router_departments.get("/{node_id}/ancestors", response_model=List[OrganizationNodeResponse])
async def get_node_ancestors(
    node_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all ancestors of a node (parents, grandparents, etc.)"""
    # Execute the stored procedure or recursive query
    from sqlalchemy import text
    query = text("CALL GetNodeAncestors(:node_id)")
    result = await db.execute(query, {"node_id": node_id})
    ancestors = result.fetchall()
    
    return [dict(ancestor._mapping) for ancestor in ancestors]


@router.get("/{node_id}/descendants", response_model=List[OrganizationNodeResponse])
@router_departments.get("/{node_id}/descendants", response_model=List[OrganizationNodeResponse])
async def get_node_descendants(
    node_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all descendants of a node (children, grandchildren, etc.)"""
    from sqlalchemy import text
    query = text("CALL GetNodeDescendants(:node_id)")
    result = await db.execute(query, {"node_id": node_id})
    descendants = result.fetchall()
    
    return [dict(descendant._mapping) for descendant in descendants]