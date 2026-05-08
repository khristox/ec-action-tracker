# routers/meetings/organization.py
"""
Organization Chart API Routes
"""
import functools
from app.api import deps
from app.crud.meetings.organization import OrganizationCRUD
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from app.models.meetings.organization import (
    OrganizationNodeCreate,
    OrganizationNodeUpdate,
    OrganizationNodeResponse,
    MoveNodeRequest,
    ReorderChildrenRequest
)
import logging
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# ==================== Helper Functions ====================

def handle_exceptions(func):
    """Decorator for consistent exception handling"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"Validation error in {func.__name__}: {str(e)}")
            raise HTTPException(status_code=400, detail=str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {str(e)}", exc_info=True)
            raise HTTPException(
                status_code=500, 
                detail="An internal server error occurred. Please try again later."
            )
    return wrapper

# ==================== CRUD Operations ====================

@router.get(
    "/tree",
    response_model=List[dict],
    summary="Get organization tree"
)
@handle_exceptions
async def get_organization_tree(
    root_id: Optional[int] = Query(None, description="Root node ID (omit for full tree)"),
    db: Session = Depends(deps.get_db)
):
    """Get organization hierarchy as a tree structure"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async methods
    if root_id:
        tree = await crud.get_tree(root_id)
    else:
        tree = await crud.get_tree()
    
    return tree if tree else []


@router.get(
    "/nodes",
    response_model=List[OrganizationNodeResponse],
    summary="Get all nodes"
)
@handle_exceptions
async def get_all_nodes(
    include_inactive: bool = Query(False, description="Include inactive nodes"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
    db: Session = Depends(deps.get_db)
):
    """Get all organization nodes as a flat list with pagination"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    nodes = await crud.get_all_nodes(
        include_inactive=include_inactive,
        skip=skip,
        limit=limit
    )
    
    return nodes


@router.get(
    "/roots",
    response_model=List[OrganizationNodeResponse],
    summary="Get root nodes"
)
@handle_exceptions
async def get_root_nodes(db: Session = Depends(deps.get_db)):
    """Get all root-level organization nodes"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    roots = await crud.get_root_nodes()
    
    return roots if roots else []


@router.get(
    "/nodes/{node_id}",
    response_model=OrganizationNodeResponse,
    summary="Get node by ID"
)
@handle_exceptions
async def get_node(
    node_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get a specific organization node"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    node = await crud.get_node(node_id)
    
    if not node:
        raise HTTPException(
            status_code=404,
            detail=f"Node with ID {node_id} not found or is inactive"
        )
    
    return node


@router.post(
    "/nodes",
    response_model=OrganizationNodeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create organization node"
)
@handle_exceptions
async def create_node(
    node_data: OrganizationNodeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Create a new organization node"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    node = await crud.create_node(node_data)
    
    background_tasks.add_task(
        logger.info, 
        f"User {current_user.id} created node {node.id}: {node.name}"
    )
    
    return node


@router.put(
    "/nodes/{node_id}",
    response_model=OrganizationNodeResponse,
    summary="Update node"
)
@handle_exceptions
async def update_node(
    node_id: int,
    update_data: OrganizationNodeUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Update an organization node"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    node = await crud.update_node(node_id, update_data)
    
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    background_tasks.add_task(
        logger.info,
        f"User {current_user.id} updated node {node.id}: {node.name}"
    )
    
    return node


@router.delete(
    "/nodes/{node_id}",
    summary="Delete node"
)
@handle_exceptions
async def delete_node(
    node_id: int,
    background_tasks: BackgroundTasks,
    cascade: bool = Query(True, description="Also delete all descendants"),
    hard_delete: bool = Query(False, description="Permanently delete (use with caution)"),
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Delete an organization node"""
    crud = OrganizationCRUD(db)
    
    # Verify node exists
    node = await crud.get_node(node_id, include_inactive=True)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    node_name = node.name
    
    # CRITICAL: Must await async methods
    if hard_delete:
        success = await crud.hard_delete_node(node_id)
    else:
        success = await crud.soft_delete_node(node_id, cascade=cascade)
    
    if not success:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    background_tasks.add_task(
        logger.info,
        f"User {current_user.id} deleted node {node_id}: {node_name} (hard={hard_delete}, cascade={cascade})"
    )
    
    return {
        "message": f"Node '{node_name}' deleted successfully",
        "node_id": node_id,
        "hard_delete": hard_delete,
        "cascade": cascade
    }


@router.patch(
    "/nodes/{node_id}/move",
    response_model=OrganizationNodeResponse,
    summary="Move node"
)
@handle_exceptions
async def move_node(
    node_id: int,
    move_request: MoveNodeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Move a node to a new parent"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    moved_node = await crud.move_node(node_id, move_request.new_parent_id, move_request.new_order)
    
    if not moved_node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    background_tasks.add_task(
        logger.info,
        f"User {current_user.id} moved node {node_id} to parent {move_request.new_parent_id}"
    )
    
    return moved_node


@router.get(
    "/nodes/{node_id}/descendants",
    response_model=List[OrganizationNodeResponse],
    summary="Get descendants"
)
@handle_exceptions
async def get_descendants(
    node_id: int,
    include_self: bool = Query(False, description="Include the node itself"),
    max_depth: Optional[int] = Query(None, ge=1, description="Maximum depth"),
    db: Session = Depends(deps.get_db)
):
    """Get all descendant nodes in the hierarchy"""
    crud = OrganizationCRUD(db)
    
    # Verify node exists
    node = await crud.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    # CRITICAL: Must await async method
    descendants = await crud.get_descendants(node_id, include_self=include_self, max_depth=max_depth)
    
    return descendants


@router.get(
    "/nodes/{node_id}/ancestors",
    response_model=List[OrganizationNodeResponse],
    summary="Get ancestors"
)
@handle_exceptions
async def get_ancestors(
    node_id: int,
    include_self: bool = Query(False, description="Include the node itself"),
    db: Session = Depends(deps.get_db)
):
    """Get all ancestor nodes in the hierarchy chain"""
    crud = OrganizationCRUD(db)
    
    # Verify node exists
    node = await crud.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    # CRITICAL: Must await async method
    ancestors = await crud.get_ancestors(node_id, include_self=include_self)
    
    return ancestors


@router.get(
    "/search",
    response_model=List[OrganizationNodeResponse],
    summary="Search nodes"
)
@handle_exceptions
async def search_nodes(
    q: str = Query(..., min_length=1, max_length=100, description="Search term"),
    limit: int = Query(50, ge=1, le=200, description="Maximum results"),
    include_inactive: bool = Query(False, description="Include inactive nodes"),
    db: Session = Depends(deps.get_db)
):
    """Search for organization nodes"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    nodes = await crud.search_nodes(q, limit, include_inactive=include_inactive)
    
    return nodes


@router.get(
    "/summary",
    summary="Get organization summary"
)
@handle_exceptions
async def get_organization_summary(db: Session = Depends(deps.get_db)):
    """Get organization hierarchy summary statistics"""
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    summary = await crud.get_hierarchy_summary()
    
    return {
        "success": True,
        "data": summary
    }


@router.patch(
    "/nodes/reorder",
    summary="Reorder children"
)
@handle_exceptions
async def reorder_children(
    request: ReorderChildrenRequest,
    parent_id: Optional[int] = Query(None, description="Parent node ID"),
    db: Session = Depends(deps.get_db)
):
    """Reorder child nodes under a parent"""
    if not request.ordered_ids:
        raise HTTPException(status_code=400, detail="ordered_ids cannot be empty")
    
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    await crud.reorder_children(parent_id, request.ordered_ids)
    
    return {
        "message": "Children reordered successfully",
        "parent_id": parent_id,
        "ordered_count": len(request.ordered_ids)
    }


@router.post(
    "/nodes/bulk",
    response_model=List[OrganizationNodeResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bulk create nodes"
)
@handle_exceptions
async def bulk_create_nodes(
    nodes_data: List[OrganizationNodeCreate],
    background_tasks: BackgroundTasks,
    db: Session = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """Create multiple organization nodes in a single request"""
    if not nodes_data:
        raise HTTPException(status_code=400, detail="nodes_data cannot be empty")
    
    if len(nodes_data) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 nodes per bulk operation")
    
    crud = OrganizationCRUD(db)
    
    # CRITICAL: Must await async method
    created_nodes = await crud.bulk_create_nodes(nodes_data)
    
    background_tasks.add_task(
        logger.info,
        f"User {current_user.id} bulk created {len(created_nodes)} nodes"
    )
    
    return created_nodes


@router.get(
    "/path/{node_id}",
    summary="Get node path"
)
@handle_exceptions
async def get_node_path(
    node_id: int,
    db: Session = Depends(deps.get_db)
):
    """Get the complete path from root to the specified node"""
    crud = OrganizationCRUD(db)
    
    node = await crud.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found")
    
    ancestors = await crud.get_ancestors(node_id, include_self=True)
    
    return {
        "node_id": node_id,
        "node_name": node.name,
        "path": [{"id": n.id, "name": n.name, "level": n.level} for n in ancestors],
        "depth": len(ancestors) - 1
    }


@router.get(
    "/export",
    summary="Export organization data"
)
@handle_exceptions
async def export_organization(
    format: str = Query("json", regex="^(json|tree)$", description="Export format"),
    db: Session = Depends(deps.get_db)
):
    """Export organization data in various formats"""
    crud = OrganizationCRUD(db)
    
    if format == "json":
        nodes = await crud.get_all_nodes()
        return {
            "export_date": datetime.utcnow().isoformat(),
            "total_nodes": len(nodes),
            "data": [node.to_dict() for node in nodes]
        }
    else:  # tree format
        tree = await crud.get_tree()
        return {
            "export_date": datetime.utcnow().isoformat(),
            "format": "tree",
            "data": tree
        }