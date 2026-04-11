# app/schemas/action_tracker_import.py
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

# ==================== Bulk Import Schemas ====================

class BulkImportPreviewRow(BaseModel):
    """Preview of a single row in bulk import"""
    row_number: int
    data: Dict[str, Any]
    errors: List[str] = Field(default_factory=list)
    is_valid: bool = True
    
    @field_validator('errors')
    @classmethod
    def validate_errors(cls, v: List[str]) -> List[str]:
        """Ensure errors list is not None"""
        return v or []


class BulkImportPreviewResponse(BaseModel):
    """Response for bulk import preview"""
    total_rows: int = Field(0, ge=0)
    valid_rows: int = Field(0, ge=0)
    invalid_rows: int = Field(0, ge=0)
    preview: List[BulkImportPreviewRow] = Field(default_factory=list, max_items=50)
    headers: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    
    @model_validator(mode='after')
    def validate_counts(self) -> 'BulkImportPreviewResponse':
        """Validate row counts"""
        self.valid_rows = sum(1 for row in self.preview if row.is_valid)
        self.invalid_rows = self.total_rows - self.valid_rows
        return self


class BulkImportResult(BaseModel):
    """Result of bulk import operation"""
    total_processed: int = Field(0, ge=0)
    successfully_imported: int = Field(0, ge=0)
    failed: int = Field(0, ge=0)
    created_participants: List[Dict[str, Any]] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.total_processed == 0:
            return 0.0
        return round((self.successfully_imported / self.total_processed) * 100, 2)


class ParticipantImportTemplate(BaseModel):
    """Template for participant import"""
    name: str = Field(..., description="Full name (required)")
    email: Optional[str] = Field(None, description="Email address")
    telephone: Optional[str] = Field(None, description="Phone number")
    title: Optional[str] = Field(None, description="Job title")
    organization: Optional[str] = Field(None, description="Organization name")
    notes: Optional[str] = Field(None, description="Additional notes")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "John Doe",
                "email": "john@example.com",
                "telephone": "+256712345678",
                "title": "Project Manager",
                "organization": "Electoral Commission",
                "notes": "Key stakeholder"
            }
        }


class BulkImportRequest(BaseModel):
    """Request for bulk import"""
    file_content: str = Field(..., description="CSV file content as string")
    skip_duplicates: bool = Field(True, description="Skip duplicate emails")
    add_to_list_id: Optional[UUID] = Field(None, description="Add imported participants to this list")