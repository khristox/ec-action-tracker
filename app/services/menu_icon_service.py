# app/services/menu_icon_service.py
from typing import Dict, Any
from enum import Enum

class IconLibrary(Enum):
    MUI = "mui"
    FONTAWESOME = "fontawesome"
    MATERIAL_SYMBOLS = "material_symbols"
    CUSTOM = "custom"

class MenuIconService:
    """Service to map menu icons to different icon libraries"""
    
    # MUI Icons mapping
    MUI_ICONS = {
        "dashboard": "Dashboard",
        "my_tasks": "Assignment",
        "overdue": "Warning",
        "completed": "CheckCircle",
        "meetings": "Event",
        "participants": "People",
        "reports": "BarChart",
        "settings": "Settings",
        "admin": "AdminPanelSettings",
    }
    
    # Font Awesome icons mapping
    FA_ICONS = {
        "dashboard": "fa-tachometer-alt",
        "my_tasks": "fa-tasks",
        "overdue": "fa-exclamation-triangle",
        "completed": "fa-check-circle",
        "meetings": "fa-calendar-alt",
        "participants": "fa-users",
        "reports": "fa-chart-bar",
        "settings": "fa-cog",
        "admin": "fa-shield-alt",
        "notifications": "fa-bell",
        "search": "fa-search",
        "add": "fa-plus-circle",
        "edit": "fa-edit",
        "delete": "fa-trash-alt",
    }
    
    # Material Symbols (Google)
    MATERIAL_SYMBOLS = {
        "dashboard": "dashboard",
        "my_tasks": "assignment",
        "overdue": "warning",
        "completed": "check_circle",
        "meetings": "event",
        "participants": "group",
        "reports": "bar_chart",
        "settings": "settings",
    }
    
    @classmethod
    def get_icon_config(cls, menu_code: str, library: str = "mui") -> Dict[str, Any]:
        """Get icon configuration for a menu"""
        
        config = {
            "type": library,
            "name": None,
            "color": "inherit",
            "size": "medium",
        }
        
        if library == "mui":
            config["name"] = cls.MUI_ICONS.get(menu_code, "Circle")
            
        elif library == "fontawesome":
            config["name"] = cls.FA_ICONS.get(menu_code, "fa-circle")
            config["library"] = "fas"  # fas, far, fal
            
        elif library == "material_symbols":
            config["name"] = cls.MATERIAL_SYMBOLS.get(menu_code, "circle")
            config["weight"] = "400"  # 100-700
            
        return config