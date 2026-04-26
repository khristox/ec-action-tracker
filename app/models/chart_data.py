# app/models/chart_data.py
from sqlalchemy import Boolean, Column, Integer, String, Float, DateTime, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db.base import Base

class ChartType(str, enum.Enum):
    BAR = "bar"
    LINE = "line"
    PIE = "pie"
    DOUGHNUT = "doughnut"
    AREA = "area"

class DataCategory(str, enum.Enum):
    TASKS = "tasks"
    MEETINGS = "meetings"
    PARTICIPANTS = "participants"
    ACTIONS = "actions"
    PERFORMANCE = "performance"

class ChartConfiguration(Base):
    __tablename__ = "chart_configurations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    title = Column(String)
    chart_type = Column(SQLEnum(ChartType))
    data_category = Column(SQLEnum(DataCategory))
    config = Column(JSON, default={})  # Store chart specific config
    query_config = Column(JSON, default={})  # Store query parameters
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ChartDataCache(Base):
    __tablename__ = "chart_data_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String, index=True, unique=True)
    data = Column(JSON)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)