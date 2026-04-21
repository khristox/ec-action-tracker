# app/api/v1/endpoints/audit.py
import csv
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, List, Optional
from datetime import datetime
from app.api import deps
from app.services.audit_service import AuditService
from app.schemas.audit import AuditLogResponse, AuditLogListResponse, AuditLogSummary
from app.models.user import User
from fastapi import Request

templates = Jinja2Templates(directory="app/templates")

router = APIRouter()

@router.get("/logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action"),
    table_name: Optional[str] = Query(None, description="Filter by table"),
    record_id: Optional[str] = Query(None, description="Filter by record ID"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
) -> Any:
    """Get audit logs with filters (admin only)"""
    audit_service = AuditService(db)
    
    logs = await audit_service.get_logs(
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset
    )
    
    total = await audit_service.count_logs(
        action=action,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "items": logs,
        "total": total,
        "page": offset // limit + 1,
        "size": limit,
        "pages": (total + limit - 1) // limit if total > 0 else 0
    }

@router.get("/logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Get specific audit log (admin only)"""
    audit_service = AuditService(db)
    logs = await audit_service.get_logs(limit=1)
    
    for log in logs:
        if str(log.id) == log_id:
            return log
    
    raise HTTPException(status_code=404, detail="Log not found")

@router.get("/users/{user_id}/activity", response_model=List[AuditLogResponse])
async def get_user_activity(
    user_id: str,
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Get user activity (admin only)"""
    audit_service = AuditService(db)
    logs = await audit_service.get_user_activity(
        user_id=uuid.UUID(user_id),
        days=days,
        limit=limit
    )
    return logs

@router.get("/records/{table_name}/{record_id}/history", response_model=List[AuditLogResponse])
async def get_record_history(
    table_name: str,
    record_id: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Get history for a specific record (admin only)"""
    audit_service = AuditService(db)
    logs = await audit_service.get_record_history(
        table_name=table_name,
        record_id=record_id,
        limit=limit
    )
    return logs

@router.get("/summary", response_model=AuditLogSummary)
async def get_activity_summary(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Get activity summary (admin only)"""
    audit_service = AuditService(db)
    summary = await audit_service.get_activity_summary(days=days)
    return summary

@router.post("/cleanup")
async def cleanup_old_logs(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Delete old audit logs (admin only)"""
    from app.core.config import settings
    audit_service = AuditService(db)
    deleted = await audit_service.cleanup_old_logs(
        retention_days=settings.AUDIT_LOG_RETENTION_DAYS
    )
    
    return {
        "message": f"Deleted {deleted} old logs",
        "retention_days": settings.AUDIT_LOG_RETENTION_DAYS
    }

@router.get("/", response_class=HTMLResponse)
async def audit_logs_page(
    request: Request,
    current_user: User = Depends(deps.require_admin)
) -> Any:
    """Render audit logs page (admin only)"""
    return templates.TemplateResponse("audit/audit_logs.html", {"request": request})


@router.get("/export")
async def export_audit_logs(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.require_admin),
    format: str = Query("csv", regex="^(csv|json)$"),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
) -> Any:
    """Export audit logs to CSV or JSON"""
    
    audit_service = AuditService(db)
    logs = await audit_service.get_logs(
        user_id=user_id,
        action=action,
        table_name=table_name,
        start_date=start_date,
        end_date=end_date,
        limit=10000  # Max export limit
    )
    
    if format == "json":
        import json
        from fastapi.responses import JSONResponse
        
        data = []
        for log in logs:
            data.append({
                "id": str(log.id),
                "timestamp": log.timestamp.isoformat(),
                "user": log.username,
                "email": log.user_email,
                "action": log.action,
                "table": log.table_name,
                "record_id": log.record_id,
                "changes": log.changes_summary,
                "status": log.status,
                "ip": log.ip_address,
                "endpoint": log.endpoint
            })
        
        return JSONResponse(content=data)
    
    else:  # CSV
        output = StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(["Timestamp", "User", "Email", "Action", "Table", "Record ID", "Changes", "Status", "IP Address", "Endpoint"])
        
        # Write data
        for log in logs:
            writer.writerow([
                log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                log.username or "System",
                log.user_email or "",
                log.action,
                log.table_name,
                log.record_id or "",
                log.changes_summary or "",
                log.status,
                log.ip_address or "",
                log.endpoint or ""
            ])
        
        response = StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = "attachment; filename=audit_logs.csv"
        return response