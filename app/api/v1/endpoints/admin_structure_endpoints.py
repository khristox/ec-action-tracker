# endpoints/admin_structure_endpoints.py
from flask import Blueprint, request, jsonify
from crud.admin_structure_crud import admin_structure_crud

admin_structure_bp = Blueprint('admin_structures', __name__, url_prefix='/api/admin-structures')

@admin_structure_bp.route('/hierarchy', methods=['GET'])
def get_hierarchy():
    """Get full hierarchy with CTE"""
    result = admin_structure_crud.get_structure_with_hierarchy()
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/tree', methods=['GET'])
def get_tree():
    """Get nested tree structure"""
    result = admin_structure_crud.get_structure_tree()
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/', methods=['GET'])
def get_all_structures():
    """Get all structures with pagination"""
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    type_filter = request.args.get('type')
    status = request.args.get('status')
    parent_id = request.args.get('parent_id')
    
    result = admin_structure_crud.get_all_structures({
        'limit': limit,
        'offset': offset,
        'type': type_filter,
        'status': status,
        'parent_id': int(parent_id) if parent_id else None
    })
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>', methods=['GET'])
def get_structure(id):
    """Get structure by ID"""
    result = admin_structure_crud.get_structure_by_id(id)
    status_code = 200 if result['success'] else 404
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>/children', methods=['GET'])
def get_children(id):
    """Get children of a structure"""
    recursive = request.args.get('recursive', 'false').lower() == 'true'
    result = admin_structure_crud.get_children(id, recursive)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>/ancestors', methods=['GET'])
def get_ancestors(id):
    """Get ancestors of a structure"""
    result = admin_structure_crud.get_ancestors(id)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>/subtree', methods=['GET'])
def get_subtree(id):
    """Get full subtree from a structure"""
    result = admin_structure_crud.get_subtree(id)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/', methods=['POST'])
def create_structure():
    """Create new structure"""
    data = request.get_json()
    result = admin_structure_crud.create_structure(data)
    status_code = 201 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>', methods=['PUT'])
def update_structure(id):
    """Update structure"""
    data = request.get_json()
    result = admin_structure_crud.update_structure(id, data)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>/status', methods=['PATCH'])
def update_status(id):
    """Update structure status"""
    data = request.get_json()
    status = data.get('status')
    
    if not status or status not in ['active', 'inactive']:
        return jsonify({
            'success': False,
            'error': 'Invalid status. Must be "active" or "inactive"'
        }), 400
    
    result = admin_structure_crud.update_structure_status(id, status)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code

@admin_structure_bp.route('/<int:id>', methods=['DELETE'])
def delete_structure(id):
    """Delete structure"""
    result = admin_structure_crud.delete_structure(id)
    status_code = 200 if result['success'] else 400
    return jsonify(result), status_code