# app/models/general/__init__.py
"""
General models for dynamic attribute system
"""
from app.models.general.dynamic_attribute import (
    AttributeGroup,
    Attribute,
    EntityAttribute,
)

__all__ = [
    "AttributeGroup",
    "Attribute",
    "EntityAttribute",
]