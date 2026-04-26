# app/schemas/chart_data.py
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class Dataset(BaseModel):
    label: str
    data: List[float]
    backgroundColor: Optional[str] = None
    borderColor: Optional[str] = None
    borderRadius: Optional[int] = None
    fill: Optional[bool] = False
    tension: Optional[float] = None
    borderWidth: Optional[int] = None

class ChartData(BaseModel):
    labels: List[str]
    datasets: List[Dataset]

class ChartDataResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: Optional[str] = None
    cached: Optional[bool] = False

class ChartConfigResponse(BaseModel):
    id: int
    name: str
    title: str
    chart_type: str
    data_category: str
    config: Optional[Dict] = {}
    query_config: Optional[Dict] = {}
    is_default: bool = False
    is_active: bool = True
    display_order: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

class ChartConfigCreate(BaseModel):
    name: str
    title: str
    chart_type: str
    data_category: str
    config: Optional[Dict] = {}
    query_config: Optional[Dict] = {}
    display_order: int = 0

class ChartConfigUpdate(BaseModel):
    title: Optional[str] = None
    config: Optional[Dict] = None
    query_config: Optional[Dict] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None