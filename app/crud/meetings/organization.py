# crud/meetings/organization.py - Updated for UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging
import uuid

from app.api import deps
from app.models.meetings.organization import OrganizationNode

logger = logging.getLogger(__name__)


class OrganizationCRUD:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_node(self, node_data: Dict[str, Any]) -> OrganizationNode:
        """Create a new organization node with UUID"""
        # Generate UUID if not provided
        node_id = str(uuid.uuid4())
        
        node = OrganizationNode(
            id=node_id,
            name=node_data.get('name'),
            title=node_data.get('title'),
            parent_id=node_data.get('parent_id'),
            order=node_data.get('order', 0),
            email=node_data.get('email'),
            phone=node_data.get('phone'),
            department_code=node_data.get('department_code'),
            location=node_data.get('location'),
            employee_count=node_data.get('employee_count', 0),
            budget=node_data.get('budget', 0.0),
            color=node_data.get('color', '#4A90E2'),
            additional_metadata=node_data.get('additional_metadata', {})
        )
        
        # Set level and path based on parent
        if node.parent_id:
            result = await self.db.execute(
                select(OrganizationNode).filter(OrganizationNode.id == node.parent_id)
            )
            parent = result.scalar_one_or_none()
            if parent:
                node.level = parent.level + 1
                node.path = f"{parent.path}/{node.id}"
            else:
                node.parent_id = None
                node.level = 0
                node.path = f"/{node.id}"
        else:
            node.level = 0
            node.path = f"/{node.id}"
        
        self.db.add(node)
        await self.db.commit()
        await self.db.refresh(node)
        
        logger.info(f"Created node: {node.name} (ID: {node.id}, Level: {node.level})")
        return node
    
    async def get_node(self, node_id: str, include_inactive: bool = False) -> Optional[OrganizationNode]:
        """Get a single node by UUID"""
        query = select(OrganizationNode).filter(OrganizationNode.id == node_id)
        if not include_inactive:
            query = query.filter(OrganizationNode.is_active == True)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_all_nodes(self, include_inactive: bool = False, skip: int = 0, limit: int = 100) -> List[OrganizationNode]:
        """Get all nodes as flat list"""
        query = select(OrganizationNode)
        if not include_inactive:
            query = query.filter(OrganizationNode.is_active == True)
        query = query.order_by(OrganizationNode.level, OrganizationNode.order).offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_root_nodes(self) -> List[OrganizationNode]:
        """Get all root nodes"""
        query = select(OrganizationNode).filter(
            OrganizationNode.parent_id.is_(None),
            OrganizationNode.is_active == True
        ).order_by(OrganizationNode.order)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_tree(self, root_id: Optional[str] = None) -> List[Dict]:
        """Get tree structure"""
        async def build_tree(node: OrganizationNode) -> Dict:
            result = await self.db.execute(
                select(OrganizationNode).filter(
                    OrganizationNode.parent_id == node.id,
                    OrganizationNode.is_active == True
                ).order_by(OrganizationNode.order)
            )
            children = result.scalars().all()
            
            node_dict = node.to_dict(include_children=False)
            node_dict['children'] = []
            
            for child in children:
                node_dict['children'].append(await build_tree(child))
            
            return node_dict
        
        if root_id:
            root = await self.get_node(root_id)
            if not root:
                return []
            return [await build_tree(root)]
        
        roots = await self.get_root_nodes()
        tree = []
        for root in roots:
            tree.append(await build_tree(root))
        return tree
    
    async def update_node(self, node_id: str, data: Dict[str, Any]) -> Optional[OrganizationNode]:
        """Update a node"""
        node = await self.get_node(node_id, include_inactive=True)
        if not node:
            return None
        
        for key, value in data.items():
            if hasattr(node, key) and key not in ['id', 'created_at', 'path', 'level']:
                setattr(node, key, value)
        
        node.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(node)
        return node
    
    # crud/meetings/organization.py - Add these methods to your OrganizationCRUD class

    async def soft_delete_node(self, node_id: str, cascade: bool = True) -> bool:
        """Soft delete a node (set is_active to False)"""
        import logging
        logger = logging.getLogger(__name__)
        
        node = await self.get_node(node_id, include_inactive=True)
        if not node:
            return False
        
        if cascade:
            # Soft delete all descendants
            descendants = await self.get_descendants(node_id)
            for descendant in descendants:
                descendant.is_active = False
                descendant.updated_at = datetime.utcnow()
        
        node.is_active = False
        node.updated_at = datetime.utcnow()
        await self.db.commit()
        
        logger.info(f"Soft deleted node {node_id}: {node.name} (cascade={cascade})")
        return True

    async def hard_delete_node(self, node_id: str) -> bool:
        """Permanently delete a node from database"""
        import logging
        logger = logging.getLogger(__name__)
        
        node = await self.db.get(OrganizationNode, node_id)
        if not node:
            return False
        
        node_name = node.name
        await self.db.delete(node)
        await self.db.commit()
        
        logger.warning(f"Hard deleted node {node_id}: {node_name}")
        return True

    async def get_descendants(self, node_id: str, include_self: bool = False) -> List[OrganizationNode]:
        """Get all descendants of a node using path matching"""
        node = await self.get_node(node_id)
        if not node:
            return []
        
        # Use path prefix matching for efficient query
        query = select(OrganizationNode).filter(
            OrganizationNode.path.like(f"{node.path}%"),
            OrganizationNode.is_active == True
        )
        
        if not include_self:
            query = query.filter(OrganizationNode.id != node_id)
        
        query = query.order_by(OrganizationNode.level, OrganizationNode.order)
        result = await self.db.execute(query)
        
        return list(result.scalars().all())
    
    def move_node(self, node_id: int, parent_id: int, position: int = None):
        """
        Move an organization node to a new parent or position
        
        Args:
            node_id: ID of the node to move
            parent_id: ID of the new parent (can be None for root)
            position: Optional position index among siblings
        """
        try:
            # Get the node to move
            node = OrganizationNode.query.get(node_id)
            if not node:
                raise ValueError(f"Organization node with id {node_id} not found")
            
            # Get the new parent (if specified)
            new_parent = None
            if parent_id:
                new_parent = OrganizationNode.query.get(parent_id)
                if not new_parent:
                    raise ValueError(f"Parent organization with id {parent_id} not found")
            
            # Store old path for updating children
            old_path = node.path
            
            # Update parent
            node.parent_id = parent_id
            
            # Update path (implement based on your tree structure)
            if new_parent:
                node.path = f"{new_parent.path}{node.id}/"
            else:
                node.path = f"/{node.id}/"
            
            # Update all children paths recursively
            self._update_children_paths(node, old_path, node.path)
            
            # Reorder siblings if position specified
            if position is not None:
                siblings = OrganizationNode.query.filter_by(parent_id=parent_id).order_by(OrganizationNode.order).all()
                # Remove the node from siblings list if present
                siblings = [s for s in siblings if s.id != node_id]
                # Insert at specified position
                siblings.insert(position, node)
                # Update order values
                for idx, sibling in enumerate(siblings):
                    sibling.order = idx
            
            deps.db.session.commit()
            return node
            
        except Exception as e:
            deps.db.session.rollback()
            raise e
    
    def _update_children_paths(self, node, old_path, new_path):
        """Recursively update paths for all children"""
        children = OrganizationNode.query.filter_by(parent_id=node.id).all()
        for child in children:
            child_old_path = child.path
            child_new_path = child.path.replace(old_path, new_path, 1)
            child.path = child_new_path
            self._update_children_paths(child, child_old_path, child_new_path)