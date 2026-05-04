# app/services/attribute_helper.py
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.general.dynamic_attribute import Attribute

class AttributeHelper:
    """Helper class to work with attribute IDs and values"""
    
    @staticmethod
    def get_attribute_value(db: Session, attribute_id: int) -> Optional[str]:
        """Get the value from an attribute's extra_metadata"""
        attribute = db.query(Attribute).filter(Attribute.id == attribute_id).first()
        if attribute and attribute.extra_metadata:
            return attribute.extra_metadata.get("value")
        return None
    
    @staticmethod
    def get_attribute_values(db: Session, attribute_ids: List[int]) -> List[str]:
        """Get values from multiple attributes"""
        if not attribute_ids:
            return []
        attributes = db.query(Attribute).filter(Attribute.id.in_(attribute_ids)).all()
        values = []
        for attr in attributes:
            if attr and attr.extra_metadata:
                value = attr.extra_metadata.get("value")
                if value:
                    values.append(value)
        return values
    
    @staticmethod
    def get_recurrence_type_value(db: Session, recurrence_type_id: int) -> Optional[str]:
        """Get recurrence type value (daily, weekly, etc.)"""
        return AttributeHelper.get_attribute_value(db, recurrence_type_id)
    
    @staticmethod
    def get_recurrence_days_values(db: Session, day_attribute_ids: List[int]) -> List[str]:
        """Get recurrence day values (monday, tuesday, etc.)"""
        return AttributeHelper.get_attribute_values(db, day_attribute_ids)
    
    @staticmethod
    def get_recurrence_week_value(db: Session, week_attribute_id: int) -> Optional[int]:
        """Get recurrence week value (1, 2, 3, 4, -1 for last)"""
        value = AttributeHelper.get_attribute_value(db, week_attribute_id)
        return int(value) if value else None
    
    @staticmethod
    def get_status_value(db: Session, status_id: int) -> Optional[str]:
        """Get recurring meeting status value (active, paused, etc.)"""
        return AttributeHelper.get_attribute_value(db, status_id)