"""
Dynamic Attribute System - Flexible attribute management for any entity.
Enhanced for Action Tracker with hierarchical structure support.
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, JSON, Index, Text, Float, Enum, text
from sqlalchemy.orm import relationship, foreign
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base
from app.db.types import UUID


class AttributeValueType(str, enum.Enum):
    """Supported value types for better type safety"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DECIMAL = "decimal"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    JSON = "json"
    ENUM = "enum"
    LIST = "list"
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"


class AttributeGroup(Base):
    """Groups related attributes together with enhanced features."""
    __tablename__ = "attribute_groups"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Entity type this group applies to (e.g., structure, tenant, user)
    entity_type = Column(String(50), nullable=True, index=True)
    
    # Behavior flags
    allow_multiple = Column(Boolean, default=False, nullable=False)
    is_required = Column(Boolean, default=False, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)  # System-defined, cannot be deleted
    
    # Validation and ordering
    validation_rules = Column(JSON, nullable=True)  # e.g., {"min": 0, "max": 100, "pattern": "^[A-Z]" }
    display_order = Column(Integer, default=0, nullable=False)
    
    # Flexible storage
    extra_metadata = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    attributes = relationship(
        "Attribute", 
        back_populates="group", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    
    __table_args__ = (
        Index("idx_attribute_groups_entity_type", "entity_type"),
        Index("idx_attribute_groups_code_entity", "code", "entity_type", unique=True),
        Index("idx_attribute_groups_display_order", "display_order"),
    )
    
    def __repr__(self):
            # Use __dict__.get to avoid triggering a lazy load/refresh
            state = getattr(self, '_sa_instance_state', None)
            if state and state.detached:
                return f"<Attribute (Detached) id={self.__dict__.get('id')}>"
            
            return f"<Attribute id={self.id} code={self.code}>"


class Attribute(Base):
    """
    Attribute definition with enhanced support for structure hierarchy.
    This defines what attributes can be assigned to entities.
    """
    __tablename__ = "attributes"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    group_id = Column(UUID, ForeignKey("attribute_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Identification fields
    code = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    short_name = Column(String(50), nullable=True)
    alt_code = Column(String(50), nullable=True)
    
    # Attribute type and constraints
    value_type = Column(Enum(AttributeValueType), default=AttributeValueType.STRING, nullable=False)
    is_required = Column(Boolean, default=False, nullable=False)
    is_unique = Column(Boolean, default=False, nullable=False)  # Unique across all entities
    is_inheritable = Column(Boolean, default=True, nullable=False)  # Can be inherited from parent
    can_inherit = Column(Boolean, default=False, nullable=False)  # Can inherit from parent
    
    # Default values
    default_value = Column(JSON, nullable=True)  # Default value as JSON
    default_value_type = Column(String(20), nullable=True)  # Type of default value
    
    # Validation rules
    validation_rules = Column(JSON, nullable=True)
    
    # Options for enum/list types
    options = Column(JSON, nullable=True)  # ["option1", "option2"] for enum types
    
    # Description
    description = Column(Text, nullable=True)
    
    # Ordering and status
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_system = Column(Boolean, default=False, nullable=False)  # System-defined, cannot be deleted
    
    # Flexible storage
    extra_metadata = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    group = relationship("AttributeGroup", back_populates="attributes")
    values = relationship("AttributeValue", back_populates="attribute", cascade="all, delete-orphan")
    entity_values = relationship("EntityAttribute", back_populates="attribute", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    
    __table_args__ = (
        Index("ix_attributes_group_code", "group_id", "code", unique=True),
        Index("ix_attributes_group_sort", "group_id", "sort_order"),
        Index("ix_attributes_t_is_active", "is_active"),
    )
    
    def get_typed_value(self, value_str: str):
        """Convert string value to proper type based on value_type"""
        if not value_str:
            return None
        
        try:
            if self.value_type == AttributeValueType.INTEGER:
                return int(value_str)
            elif self.value_type == AttributeValueType.FLOAT:
                return float(value_str)
            elif self.value_type == AttributeValueType.DECIMAL:
                from decimal import Decimal
                return Decimal(value_str)
            elif self.value_type == AttributeValueType.BOOLEAN:
                return value_str.lower() in ['true', '1', 'yes', 'on']
            elif self.value_type == AttributeValueType.DATE:
                from datetime import date
                return date.fromisoformat(value_str)
            elif self.value_type == AttributeValueType.DATETIME:
                from datetime import datetime
                return datetime.fromisoformat(value_str)
            elif self.value_type == AttributeValueType.JSON:
                import json
                return json.loads(value_str)
            else:
                return value_str
        except (ValueError, TypeError):
            return value_str
    
    # dynamic_attribute.py, line ~180

    def __repr__(self):
        try:
            # Use PASSIVE_NO_FETCH to avoid triggering a DB load
            from sqlalchemy.orm.base import PASSIVE_NO_FETCH
            from sqlalchemy import inspect as sa_inspect
            
            state = sa_inspect(self)
            if state.detached or state.expired:
                return f"<{self.__class__.__name__} (detached)>"
            
            id_value = object.__getattribute__(self, 'id')
            return f"<{self.__class__.__name__} id={id_value}>"
        except Exception:
            return f"<{self.__class__.__name__} (unavailable)>"


class AttributeValue(Base):
    """
    Stores actual values for attributes assigned to entities.
    Optimized for quick lookups and filtering.
    """
    __tablename__ = "attribute_values"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    attribute_id = Column(UUID, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Entity identification (polymorphic)
    entity_type = Column(String(50), nullable=False, index=True)  # structure, tenant, user, etc.
    entity_id = Column(UUID, nullable=False, index=True)
    
    # Value storage with multiple types for better filtering
    value_string = Column(String(1000), nullable=True)
    value_integer = Column(Integer, nullable=True)
    value_float = Column(Float, nullable=True)
    value_boolean = Column(Boolean, nullable=True)
    value_date = Column(DateTime(timezone=True), nullable=True)
    value_json = Column(JSON, nullable=True)
    
    # Which type is actually used
    value_type = Column(String(20), nullable=False)
    
    # Display-friendly version
    value_display = Column(String(500), nullable=True)
    
    # Inheritance tracking
    inherited_from_id = Column(UUID, nullable=True)  # ID of parent entity if inherited
    is_inherited = Column(Boolean, default=False, nullable=False)
    
    # Additional metadata
    extra_metadata = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    attribute = relationship("Attribute", back_populates="values")
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    
    __table_args__ = (
        Index("ix_attribute_values_entity", "entity_type", "entity_id"),
        Index("ix_attribute_values_attribute_entity", "attribute_id", "entity_type", "entity_id", unique=True),
        Index("ix_attribute_values_string", "value_string"),
        Index("ix_attribute_values_integer", "value_integer"),
        Index("ix_attribute_values_boolean", "value_boolean"),
    )
    
    def get_value(self):
        """Get the value in its proper type"""
        if self.value_type == "string":
            return self.value_string
        elif self.value_type == "integer":
            return self.value_integer
        elif self.value_type == "float":
            return self.value_float
        elif self.value_type == "boolean":
            return self.value_boolean
        elif self.value_type == "date":
            return self.value_date
        elif self.value_type == "json":
            return self.value_json
        return None
    
    def set_value(self, value, value_type: str):
        """Set the value in the appropriate column"""
        self.value_type = value_type
        
        if value_type == "string":
            self.value_string = str(value) if value is not None else None
        elif value_type == "integer":
            self.value_integer = int(value) if value is not None else None
        elif value_type == "float":
            self.value_float = float(value) if value is not None else None
        elif value_type == "boolean":
            self.value_boolean = bool(value) if value is not None else None
        elif value_type == "date":
            self.value_date = value
        elif value_type == "json":
            self.value_json = value
    
    def __repr__(self) -> str:
        return f"<AttributeValue {self.attribute.code if self.attribute else 'None'}: {self.get_value()} for {self.entity_type}:{self.entity_id}>"


class EntityAttribute(Base):
    """
    Enhanced entity-attribute relationship with full audit trail.
    This is the main table for storing attribute values with versioning support.
    """
    __tablename__ = "entity_attributes"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # Entity identification
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID, nullable=False, index=True)
    attribute_id = Column(UUID, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Value storage with type information
    value_text = Column(Text, nullable=True)
    value_number = Column(Float, nullable=True)
    value_date = Column(DateTime(timezone=True), nullable=True)
    value_boolean = Column(Boolean, nullable=True)
    value_json = Column(JSON, nullable=True)
    value_type = Column(String(20), default="text", nullable=False)
    
    # Metadata about the value
    is_system_value = Column(Boolean, default=False, nullable=False)
    is_inherited = Column(Boolean, default=False, nullable=False)
    inherited_from_id = Column(UUID, nullable=True)  # ID of source entity
    
    # Versioning (for audit trail)
    version = Column(Integer, default=1, nullable=False)
    is_current = Column(Boolean, default=True, nullable=False, index=True)
    
    # Additional metadata
    extra_data = Column(JSON, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    updated_by_id = Column(UUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    attribute = relationship("Attribute", back_populates="entity_values")
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    
    __table_args__ = (
        Index("ix_entity_attributes_entity", "entity_type", "entity_id"),
        Index("ix_entity_attributes_entity_current", "entity_type", "entity_id", "is_current"),
        Index("ix_entity_attributes_unique_current", "entity_type", "entity_id", "attribute_id", 
              unique=True, postgresql_where=text("is_current = true")),
        Index("ix_entity_attributes_attribute", "attribute_id"),
    )
    
    def get_typed_value(self):
        """Get the value cast to its proper type"""
        if self.value_type == "text":
            return self.value_text
        elif self.value_type == "number":
            return self.value_number
        elif self.value_type == "boolean":
            return self.value_boolean
        elif self.value_type == "date":
            return self.value_date
        elif self.value_type == "json":
            return self.value_json
        return None
    
    def set_typed_value(self, value, value_type: str):
        """Set the value with proper type"""
        self.value_type = value_type
        
        if value_type == "text":
            self.value_text = str(value) if value is not None else None
        elif value_type == "number":
            self.value_number = float(value) if value is not None else None
        elif value_type == "boolean":
            self.value_boolean = bool(value) if value is not None else None
        elif value_type == "date":
            self.value_date = value
        elif value_type == "json":
            self.value_json = value
    
    def __repr__(self) -> str:
        return f"<EntityAttribute {self.entity_type}:{self.entity_id} -> {self.attribute.code if self.attribute else 'None'}: {self.get_typed_value()}>"