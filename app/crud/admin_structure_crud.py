# crud/admin_structure_crud.py
from typing import Dict, List, Optional, Any
from models.admin_structure_model import AdminStructureModel
from schemas.admin_structure_schema import (
    AdminStructureCreateSchema,
    AdminStructureUpdateSchema,
    IdParamSchema,
    QueryParamsSchema,
    ChildrenQuerySchema
)
from marshmallow import ValidationError

class AdminStructureCRUD:
    
    def __init__(self):
        self.create_schema = AdminStructureCreateSchema()
        self.update_schema = AdminStructureUpdateSchema()
        self.id_schema = IdParamSchema()
        self.query_schema = QueryParamsSchema()
        self.children_query_schema = ChildrenQuerySchema()
    
    def create_structure(self, structure_data: Dict) -> Dict:
        """Create new structure"""
        try:
            # Validate data
            validated_data = self.create_schema.load(structure_data)
            
            # Check for duplicate code
            existing = AdminStructureModel.get_all(limit=1000, offset=0)
            if any(s['code'] == validated_data['code'] for s in existing):
                return {
                    'success': False,
                    'error': f"Structure with code {validated_data['code']} already exists"
                }
            
            # Check if parent exists
            if validated_data.get('parent_id'):
                parent = AdminStructureModel.get_by_id(validated_data['parent_id'])
                if not parent:
                    return {
                        'success': False,
                        'error': f"Parent structure with id {validated_data['parent_id']} not found"
                    }
            
            result = AdminStructureModel.create(validated_data)
            return {
                'success': True,
                'data': result,
                'message': 'Structure created successfully'
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Validation error: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_structure_with_hierarchy(self) -> Dict:
        """Get structure with hierarchy"""
        try:
            structures = AdminStructureModel.get_all_with_hierarchy()
            return {
                'success': True,
                'data': structures,
                'total': len(structures)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_structure_tree(self) -> Dict:
        """Get structure tree"""
        try:
            flat_tree = AdminStructureModel.get_structure_tree()
            # Build nested tree structure
            nested_tree = self._build_tree(flat_tree)
            return {
                'success': True,
                'data': nested_tree
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def _build_tree(self, flat_array: List[Dict], parent_id: Optional[int] = None) -> List[Dict]:
        """Build nested tree from flat array"""
        tree = []
        for item in flat_array:
            if item['parent_id'] == parent_id:
                children = self._build_tree(flat_array, item['id'])
                if children:
                    item['children'] = children
                tree.append(item)
        return tree
    
    def get_children(self, id: int, recursive: bool = False) -> Dict:
        """Get children of a node"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            children = AdminStructureModel.get_children(id, recursive)
            return {
                'success': True,
                'data': children,
                'total': len(children),
                'recursive': recursive
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_ancestors(self, id: int) -> Dict:
        """Get ancestors of a node"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            ancestors = AdminStructureModel.get_ancestors(id)
            return {
                'success': True,
                'data': ancestors,
                'total': len(ancestors)
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_subtree(self, id: int) -> Dict:
        """Get subtree from a node"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            subtree = AdminStructureModel.get_subtree(id)
            return {
                'success': True,
                'data': subtree,
                'total': len(subtree)
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_all_structures(self, filters: Optional[Dict] = None) -> Dict:
        """Get all structures with filters"""
        try:
            if filters is None:
                filters = {}
            
            # Validate filters
            validated_filters = self.query_schema.load(filters)
            
            structures = AdminStructureModel.get_all(
                limit=validated_filters['limit'],
                offset=validated_filters['offset']
            )
            
            # Apply additional filters
            if validated_filters.get('type'):
                structures = [s for s in structures if s['type'] == validated_filters['type']]
            if validated_filters.get('status'):
                structures = [s for s in structures if s['status'] == validated_filters['status']]
            if validated_filters.get('parent_id') is not None:
                structures = [s for s in structures if s['parent_id'] == validated_filters['parent_id']]
            
            return {
                'success': True,
                'data': structures,
                'total': len(structures),
                'limit': validated_filters['limit'],
                'offset': validated_filters['offset']
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid filters: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_structure_by_id(self, id: int) -> Dict:
        """Get structure by ID"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            structure = AdminStructureModel.get_by_id(id)
            if not structure:
                return {
                    'success': False,
                    'error': f"Structure with id {id} not found"
                }
            
            return {
                'success': True,
                'data': structure
            }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_structure(self, id: int, update_data: Dict) -> Dict:
        """Update structure"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            # Validate update data
            validated_data = self.update_schema.load(update_data)
            
            # Check if structure exists
            existing = AdminStructureModel.get_by_id(id)
            if not existing:
                return {
                    'success': False,
                    'error': f"Structure with id {id} not found"
                }
            
            # Check if parent exists when updating parent_id
            if 'parent_id' in validated_data and validated_data['parent_id']:
                parent = AdminStructureModel.get_by_id(validated_data['parent_id'])
                if not parent:
                    return {
                        'success': False,
                        'error': f"Parent structure with id {validated_data['parent_id']} not found"
                    }
                # Prevent circular reference
                if validated_data['parent_id'] == id:
                    return {
                        'success': False,
                        'error': "Cannot set parent to itself"
                    }
            
            updated = AdminStructureModel.update(id, validated_data)
            if updated:
                return {
                    'success': True,
                    'message': 'Structure updated successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to update structure'
                }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Validation error: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def delete_structure(self, id: int) -> Dict:
        """Delete structure"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            existing = AdminStructureModel.get_by_id(id)
            if not existing:
                return {
                    'success': False,
                    'error': f"Structure with id {id} not found"
                }
            
            deleted = AdminStructureModel.delete(id)
            if deleted:
                return {
                    'success': True,
                    'message': 'Structure deleted successfully'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to delete structure'
                }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def update_structure_status(self, id: int, status: str) -> Dict:
        """Update structure status"""
        try:
            # Validate ID
            self.id_schema.load({'id': id})
            
            existing = AdminStructureModel.get_by_id(id)
            if not existing:
                return {
                    'success': False,
                    'error': f"Structure with id {id} not found"
                }
            
            updated = AdminStructureModel.update_status(id, status)
            if updated:
                return {
                    'success': True,
                    'message': f"Status updated to {status} successfully"
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to update status'
                }
        except ValidationError as e:
            return {
                'success': False,
                'error': f"Invalid ID: {e.messages}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

# Singleton instance
admin_structure_crud = AdminStructureCRUD()