# crud/meetings/organization.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.meetings.organization import OrganizationNode

class OrganizationCRUD:
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_node(self, data: Dict[str, Any]) -> OrganizationNode:
        """Create a new organization node"""
        node = OrganizationNode(
            name=data.get('name'),
            title=data.get('title'),
            parent_id=data.get('parent_id'),
            order=data.get('order', 0),
            email=data.get('email'),
            phone=data.get('phone'),
            department_code=data.get('department_code'),
            location=data.get('location'),
            employee_count=data.get('employee_count', 0),
            budget=data.get('budget', 0.0),
            color=data.get('color', '#4A90E2'),
            additional_metadata=data.get('additional_metadata', {})
        )
        
        # Handle parent relationship
        if node.parent_id:
            result = await self.db.execute(
                select(OrganizationNode).filter(OrganizationNode.id == node.parent_id)
            )
            parent = result.scalar_one_or_none()
            if parent:
                node.level = parent.level + 1
                self.db.add(node)
                await self.db.flush()
                node.path = f"{parent.path}/{node.id}"
            else:
                node.parent_id = None
                node.level = 0
                self.db.add(node)
                await self.db.flush()
                node.path = f"/{node.id}"
        else:
            node.level = 0
            self.db.add(node)
            await self.db.flush()
            node.path = f"/{node.id}"
        
        await self.db.commit()
        await self.db.refresh(node)
        return node
    
    async def get_node(self, node_id: int, include_inactive: bool = False) -> Optional[OrganizationNode]:
        """Get a single node by ID"""
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
    
    async def get_tree(self, root_id: Optional[int] = None) -> List[Dict]:
        """Get tree structure"""
        if root_id:
            root = await self.get_node(root_id)
            if not root:
                return []
            return [await self._build_tree_dict(root)]
        
        roots = await self.get_root_nodes()
        tree = []
        for root in roots:
            tree.append(await self._build_tree_dict(root))
        return tree
    
    async def _build_tree_dict(self, node: OrganizationNode) -> Dict:
        """Recursively build tree dictionary"""
        # Get children
        query = select(OrganizationNode).filter(
            OrganizationNode.parent_id == node.id,
            OrganizationNode.is_active == True
        ).order_by(OrganizationNode.order)
        result = await self.db.execute(query)
        children = result.scalars().all()
        
        # Build node dict
        node_dict = {
            'id': node.id,
            'name': node.name,
            'title': node.title,
            'parent_id': node.parent_id,
            'level': node.level,
            'path': node.path,
            'order': node.order,
            'is_active': node.is_active,
            'email': node.email,
            'phone': node.phone,
            'department_code': node.department_code,
            'location': node.location,
            'employee_count': node.employee_count,
            'budget': node.budget,
            'color': node.color,
            'additional_metadata': node.additional_metadata,
            'created_at': node.created_at.isoformat() if node.created_at else None,
            'updated_at': node.updated_at.isoformat() if node.updated_at else None,
            'children': []
        }
        
        # Add children recursively
        for child in children:
            node_dict['children'].append(await self._build_tree_dict(child))
        
        return node_dict
    
    async def update_node(self, node_id: int, data: Dict[str, Any]) -> Optional[OrganizationNode]:
        """Update a node"""
        node = await self.get_node(node_id, include_inactive=True)
        if not node:
            return None
        
        # Update fields
        for key, value in data.items():
            if hasattr(node, key) and key not in ['id', 'created_at', 'path', 'level']:
                setattr(node, key, value)
        
        node.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(node)
        return node
    
    async def delete_node(self, node_id: int, soft_delete: bool = True) -> bool:
        """Delete a node"""
        node = await self.get_node(node_id, include_inactive=True)
        if not node:
            return False
        
        if soft_delete:
            node.is_active = False
            node.updated_at = datetime.utcnow()
        else:
            await self.db.delete(node)
        
        await self.db.commit()
        return True