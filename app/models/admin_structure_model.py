# models/admin_structure_model.py
from typing import Dict, List, Optional, Any
from datetime import datetime
import mysql.connector
from mysql.connector import Error
from config.database import get_db_connection

class AdminStructureModel:
    
    @staticmethod
    def get_all_with_hierarchy() -> List[Dict]:
        """Get all admin structures with CTE hierarchy"""
        query = """
        WITH RECURSIVE admin_hierarchy AS (
            -- Anchor member: get root nodes (parent_id is null)
            SELECT 
                id,
                name,
                code,
                type,
                parent_id,
                level,
                status,
                created_at,
                updated_at,
                1 as depth,
                CAST(id AS CHAR(1000)) as path,
                CAST(name AS CHAR(1000)) as path_name
            FROM admin_structures
            WHERE parent_id IS NULL
            
            UNION ALL
            
            -- Recursive member: get children
            SELECT 
                c.id,
                c.name,
                c.code,
                c.type,
                c.parent_id,
                c.level,
                c.status,
                c.created_at,
                c.updated_at,
                p.depth + 1 as depth,
                CONCAT(p.path, '->', c.id) as path,
                CONCAT(p.path_name, ' -> ', c.name) as path_name
            FROM admin_structures c
            INNER JOIN admin_hierarchy p ON c.parent_id = p.id
        )
        SELECT * FROM admin_hierarchy
        ORDER BY path
        """
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_structure_tree() -> List[Dict]:
        """Get structure tree using CTE"""
        query = """
        WITH RECURSIVE admin_tree AS (
            SELECT 
                id,
                name,
                code,
                type,
                parent_id,
                level,
                status,
                1 as depth,
                CAST(id AS CHAR(1000)) as sort_path
            FROM admin_structures
            WHERE parent_id IS NULL
            
            UNION ALL
            
            SELECT 
                c.id,
                c.name,
                c.code,
                c.type,
                c.parent_id,
                c.level,
                c.status,
                p.depth + 1,
                CONCAT(p.sort_path, '/', c.id)
            FROM admin_structures c
            INNER JOIN admin_tree p ON c.parent_id = p.id
        )
        SELECT * FROM admin_tree
        ORDER BY sort_path
        """
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_children(parent_id: int, recursive: bool = False) -> List[Dict]:
        """Get children of specific node"""
        if recursive:
            query = """
            WITH RECURSIVE descendants AS (
                SELECT * FROM admin_structures WHERE id = %s
                UNION ALL
                SELECT c.* FROM admin_structures c
                INNER JOIN descendants d ON c.parent_id = d.id
            )
            SELECT * FROM descendants WHERE id != %s
            """
            params = (parent_id, parent_id)
        else:
            query = "SELECT * FROM admin_structures WHERE parent_id = %s"
            params = (parent_id,)
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params)
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_ancestors(node_id: int) -> List[Dict]:
        """Get ancestors of specific node"""
        query = """
        WITH RECURSIVE ancestors AS (
            SELECT * FROM admin_structures WHERE id = %s
            UNION ALL
            SELECT p.* FROM admin_structures p
            INNER JOIN ancestors a ON p.id = a.parent_id
        )
        SELECT * FROM ancestors WHERE id != %s
        """
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (node_id, node_id))
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_subtree(root_id: int) -> List[Dict]:
        """Get subtree from node"""
        query = """
        WITH RECURSIVE subtree AS (
            SELECT * FROM admin_structures WHERE id = %s
            UNION ALL
            SELECT c.* FROM admin_structures c
            INNER JOIN subtree s ON c.parent_id = s.id
        )
        SELECT * FROM subtree
        """
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (root_id,))
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_all(limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get all structures with pagination"""
        query = "SELECT * FROM admin_structures LIMIT %s OFFSET %s"
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (limit, offset))
        results = cursor.fetchall()
        cursor.close()
        connection.close()
        return results
    
    @staticmethod
    def get_by_id(id: int) -> Optional[Dict]:
        """Get single structure by ID"""
        query = "SELECT * FROM admin_structures WHERE id = %s"
        
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, (id,))
        result = cursor.fetchone()
        cursor.close()
        connection.close()
        return result
    
    @staticmethod
    def create(structure_data: Dict) -> Dict:
        """Create new structure"""
        name = structure_data.get('name')
        code = structure_data.get('code')
        type_ = structure_data.get('type')
        parent_id = structure_data.get('parent_id')
        level = structure_data.get('level')
        status = structure_data.get('status', 'active')
        
        # Calculate level based on parent
        calculated_level = level
        if parent_id and not calculated_level:
            parent = AdminStructureModel.get_by_id(parent_id)
            calculated_level = parent['level'] + 1 if parent else 1
        elif not calculated_level:
            calculated_level = 1
        
        query = """
        INSERT INTO admin_structures (name, code, type, parent_id, level, status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
        """
        
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, (name, code, type_, parent_id, calculated_level, status))
        connection.commit()
        
        new_id = cursor.lastrowid
        cursor.close()
        connection.close()
        
        return {
            'id': new_id,
            'name': name,
            'code': code,
            'type': type_,
            'parent_id': parent_id,
            'level': calculated_level,
            'status': status
        }
    
    @staticmethod
    def update(id: int, structure_data: Dict) -> bool:
        """Update structure"""
        updates = []
        params = []
        
        if 'name' in structure_data:
            updates.append("name = %s")
            params.append(structure_data['name'])
        if 'code' in structure_data:
            updates.append("code = %s")
            params.append(structure_data['code'])
        if 'type' in structure_data:
            updates.append("type = %s")
            params.append(structure_data['type'])
        if 'parent_id' in structure_data:
            updates.append("parent_id = %s")
            params.append(structure_data['parent_id'])
        if 'level' in structure_data:
            updates.append("level = %s")
            params.append(structure_data['level'])
        if 'status' in structure_data:
            updates.append("status = %s")
            params.append(structure_data['status'])
        
        if not updates:
            return False
        
        updates.append("updated_at = NOW()")
        params.append(id)
        
        query = f"UPDATE admin_structures SET {', '.join(updates)} WHERE id = %s"
        
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, params)
        connection.commit()
        
        affected_rows = cursor.rowcount
        cursor.close()
        connection.close()
        
        return affected_rows > 0
    
    @staticmethod
    def delete(id: int) -> bool:
        """Delete structure"""
        # Check if has children
        children = AdminStructureModel.get_children(id)
        if children:
            raise Exception("Cannot delete structure with children. Remove children first.")
        
        query = "DELETE FROM admin_structures WHERE id = %s"
        
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, (id,))
        connection.commit()
        
        affected_rows = cursor.rowcount
        cursor.close()
        connection.close()
        
        return affected_rows > 0
    
    @staticmethod
    def update_status(id: int, status: str) -> bool:
        """Update structure status"""
        query = "UPDATE admin_structures SET status = %s, updated_at = NOW() WHERE id = %s"
        
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(query, (status, id))
        connection.commit()
        
        affected_rows = cursor.rowcount
        cursor.close()
        connection.close()
        
        return affected_rows > 0