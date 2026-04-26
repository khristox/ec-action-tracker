# schemas/admin_structure_schema.py
from marshmallow import Schema, fields, validate, ValidationError
from typing import Dict, Any

class AdminStructureSchema(Schema):
    """Base schema for admin structure validation"""
    
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    code = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    type = fields.Str(
        required=True,
        validate=validate.OneOf([
            'country', 'state', 'city', 'district', 
            'block', 'village', 'office', 'department'
        ])
    )
    parent_id = fields.Int(allow_none=True, validate=validate.Range(min=1))
    level = fields.Int(validate=validate.Range(min=1, max=10), allow_none=True)
    status = fields.Str(
        validate=validate.OneOf(['active', 'inactive']),
        missing='active'
    )
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)

class AdminStructureCreateSchema(Schema):
    """Schema for creating admin structure"""
    
    name = fields.Str(required=True, validate=validate.Length(min=2, max=100))
    code = fields.Str(required=True, validate=validate.Length(min=2, max=50))
    type = fields.Str(
        required=True,
        validate=validate.OneOf([
            'country', 'state', 'city', 'district', 
            'block', 'village', 'office', 'department'
        ])
    )
    parent_id = fields.Int(allow_none=True, validate=validate.Range(min=1))
    level = fields.Int(validate=validate.Range(min=1, max=10), allow_none=True)
    status = fields.Str(validate=validate.OneOf(['active', 'inactive']), missing='active')

class AdminStructureUpdateSchema(Schema):
    """Schema for updating admin structure"""
    
    name = fields.Str(validate=validate.Length(min=2, max=100))
    code = fields.Str(validate=validate.Length(min=2, max=50))
    type = fields.Str(validate=validate.OneOf([
        'country', 'state', 'city', 'district', 
        'block', 'village', 'office', 'department'
    ]))
    parent_id = fields.Int(allow_none=True, validate=validate.Range(min=1))
    level = fields.Int(validate=validate.Range(min=1, max=10))
    status = fields.Str(validate=validate.OneOf(['active', 'inactive']))

class IdParamSchema(Schema):
    """Schema for ID parameter validation"""
    
    id = fields.Int(required=True, validate=validate.Range(min=1))

class QueryParamsSchema(Schema):
    """Schema for query parameters"""
    
    limit = fields.Int(missing=100, validate=validate.Range(min=1, max=1000))
    offset = fields.Int(missing=0, validate=validate.Range(min=0))
    type = fields.Str(validate=validate.OneOf([
        'country', 'state', 'city', 'district', 
        'block', 'village', 'office', 'department'
    ]))
    status = fields.Str(validate=validate.OneOf(['active', 'inactive']))
    parent_id = fields.Int(allow_none=True, validate=validate.Range(min=1))

class ChildrenQuerySchema(Schema):
    """Schema for children query parameters"""
    
    recursive = fields.Bool(missing=False)

# Type constants
STRUCTURE_TYPES = {
    'COUNTRY': 'country',
    'STATE': 'state',
    'CITY': 'city',
    'DISTRICT': 'district',
    'BLOCK': 'block',
    'VILLAGE': 'village',
    'OFFICE': 'office',
    'DEPARTMENT': 'department'
}

STRUCTURE_STATUS = {
    'ACTIVE': 'active',
    'INACTIVE': 'inactive'
}