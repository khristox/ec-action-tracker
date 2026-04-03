# app/models/user_attribute.py

"""
User Extended Attributes Model - Stores additional user data dynamically
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.db.base import Base
from app.db.types import UUID as CustomUUID
import uuid
from datetime import datetime


class UserAttribute(Base):
    """
    Stores extended user attributes linked to the attribute system.
    This allows dynamic addition of user fields without schema changes.
    
    Each record represents a single attribute value for a user.
    Examples: bio, address, city, postal_code, profile_picture, etc.
    """
    __tablename__ = "user_attributes"
    __table_args__ = (
        Index('idx_user_attribute_user', 'user_id'),
        Index('idx_user_attribute_attribute', 'attribute_id'),
        Index('idx_user_attribute_unique', 'user_id', 'attribute_id', unique=True),
        Index('idx_user_attribute_created_by', 'created_by'),
        Index('idx_user_attribute_created_at', 'created_at'),
        {'extend_existing': True}
    )
    
    # ==================== PRIMARY KEY ====================
    id = Column(CustomUUID, primary_key=True, default=uuid.uuid4, index=True)
    
    # ==================== FOREIGN KEYS ====================
    user_id = Column(CustomUUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    attribute_id = Column(CustomUUID, ForeignKey("attributes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # ==================== VALUE STORAGE (Polymorphic) ====================
    # Only one of these will be populated based on the attribute type
    value_text = Column(Text, nullable=True)           # For string values
    value_number = Column(JSON, nullable=True)         # For numeric values (int/float)
    value_date = Column(DateTime(timezone=True), nullable=True)  # For date/time values
    value_boolean = Column(JSON, nullable=True)        # For boolean values
    value_json = Column(JSON, nullable=True)           # For complex/JSON data
    
    # ==================== METADATA ====================
    extra_metadata = Column(JSON, default=dict)  # Additional metadata for this specific assignment
    
    # ==================== AUDIT FIELDS ====================
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(CustomUUID, nullable=True, index=True)  # User who created this attribute
    updated_by = Column(CustomUUID, nullable=True)  # User who last updated this attribute
    
    # ==================== RELATIONSHIPS ====================
    user = relationship("User", back_populates="extended_attributes")
    attribute = relationship("Attribute", foreign_keys=[attribute_id])
    
    # ==================== PROPERTIES ====================
    
    @property
    def value(self):
        """
        Get the value based on which field is populated.
        Returns the appropriate value based on the stored type.
        """
        if self.value_text is not None:
            return self.value_text
        elif self.value_number is not None:
            # Handle numeric values stored as JSON
            if isinstance(self.value_number, dict) and "value" in self.value_number:
                return self.value_number["value"]
            return self.value_number
        elif self.value_date is not None:
            return self.value_date
        elif self.value_boolean is not None:
            # Handle boolean values stored as JSON
            if isinstance(self.value_boolean, dict) and "value" in self.value_boolean:
                return self.value_boolean["value"]
            return self.value_boolean
        elif self.value_json is not None:
            return self.value_json
        return None
    
    @value.setter
    def value(self, val):
        """
        Set the value by determining its type and storing in the appropriate field.
        This automatically routes the value to the correct column based on type.
        """
        # Clear all value fields first
        self.value_text = None
        self.value_number = None
        self.value_date = None
        self.value_boolean = None
        self.value_json = None
        
        if val is None:
            return
        
        # Set appropriate field based on Python type
        if isinstance(val, str):
            self.value_text = val
        elif isinstance(val, (int, float)):
            self.value_number = {"value": val, "type": type(val).__name__}
        elif isinstance(val, bool):
            self.value_boolean = {"value": val}
        elif isinstance(val, datetime):
            self.value_date = val
        else:
            # For lists, dicts, and other complex types
            self.value_json = val
    
    @property
    def value_type(self) -> str:
        """
        Get the type of value stored.
        Returns: 'text', 'number', 'date', 'boolean', 'json', or 'unknown'
        """
        if self.value_text is not None:
            return 'text'
        elif self.value_number is not None:
            return 'number'
        elif self.value_date is not None:
            return 'date'
        elif self.value_boolean is not None:
            return 'boolean'
        elif self.value_json is not None:
            return 'json'
        return 'unknown'
    
    @property
    def attribute_code(self) -> str:
        """Get the attribute code from the linked attribute"""
        if self.attribute:
            return self.attribute.code
        return None
    
    @property
    def attribute_name(self) -> str:
        """Get the attribute name from the linked attribute"""
        if self.attribute:
            return self.attribute.name
        return None
    
    # ==================== METHODS ====================
    
    def to_dict(self) -> dict:
        """
        Convert to dictionary representation.
        Returns a dict with all relevant fields.
        """
        return {
            "id": str(self.id),
            "user_id": str(self.user_id),
            "attribute_id": str(self.attribute_id),
            "attribute_code": self.attribute_code,
            "attribute_name": self.attribute_name,
            "value": self.value,
            "value_type": self.value_type,
            "extra_metadata": self.extra_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by": str(self.created_by) if self.created_by else None,
            "updated_by": str(self.updated_by) if self.updated_by else None,
        }
    
    def __repr__(self):
        attr_code = self.attribute.code if self.attribute else "unknown"
        return f"<UserAttribute user={self.user_id} attribute={attr_code} value={self.value}>"