# app/api/v1/endpoints/action_tracker/audit_logger.py

import json
import uuid
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.models.user import User
from sqlalchemy import select

async def log_audit(
    db: AsyncSession,
    action: str,
    table_name: str,
    record_id: str,
    user_id: Optional[str] = None,
    old_values: Optional[Dict] = None,
    new_values: Optional[Dict] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    endpoint: Optional[str] = None,
    request_id: Optional[str] = None,
    extra_data: Optional[Dict] = None,
    meeting_id: Optional[str] = None
):
    """Generic audit logging function"""
    
    # Get user info if user_id provided
    username = None
    user_email = None
    if user_id:
        user_result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = user_result.scalar_one_or_none()
        if user:
            username = user.username
            user_email = user.email
    
    # Calculate changes summary
    changes_summary = None
    if old_values and new_values and status == "success":
        changes = []
        for key in old_values:
            if key in new_values and old_values[key] != new_values[key]:
                old_val = old_values[key] if old_values[key] is not None else "None"
                new_val = new_values[key] if new_values[key] is not None else "None"
                changes.append(f"{key}: {old_val} → {new_val}")
        changes_summary = "; ".join(changes) if changes else "No changes detected"
    
    # Prepare extra_data with meeting_id if provided
    extra_data_dict = extra_data or {}
    if meeting_id:
        extra_data_dict["meeting_id"] = str(meeting_id)
    
    # Convert old_values and new_values to JSON strings for old_data and new_data columns
    old_data_json = json.dumps(old_values) if old_values else None
    new_data_json = json.dumps(new_values) if new_values else None
    
    # Create audit log entry using the correct column names from your table
    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=str(user_id) if user_id else None,
        username=username,
        user_email=user_email,
        action=action,
        table_name=table_name,
        record_id=str(record_id),
        # Note: Your table uses 'old_data' and 'new_data', not 'old_values'/'new_values'
        old_data=old_data_json,  # Changed from old_values
        new_data=new_data_json,  # Changed from new_values
        ip_address=ip_address,
        user_agent=user_agent,
        endpoint=endpoint,
        request_id=request_id,
        changes_summary=changes_summary,
        status=status,
        error_message=error_message,
        extra_data=json.dumps(extra_data_dict) if extra_data_dict else None,
        timestamp=datetime.now()
    )
    
    db.add(audit_log)
    await db.commit()