# app/api/v1/endpoints/action_tracker/meeting_report.py

from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from io import BytesIO
import html
import base64
import os
from pathlib import Path

from app.api import deps
from app.db.session import get_db
from app.models.user import User
from app.models.action_tracker import (
    Meeting, MeetingMinutes, MeetingAction,
    MeetingParticipant, MeetingStatusHistory
)
from app.schemas.meeting_report import (
    MeetingReportResponse, MeetingReportParticipant,
    MeetingReportMinute, MeetingReportAction
)

router = APIRouter()


def escape_html(text):
    """Safely escape HTML text, handling None values"""
    if text is None:
        return ''
    return html.escape(str(text))


def get_logo_base64():
    """Get logo as base64 string for embedding in HTML"""
    logo_paths = [
        Path("static/logo1.png"),
        Path("app/static/logo1.png"),
        Path("public/logo1.png"),
        Path("../public/logo1.png"),
        Path("static/images/logo1.png"),
        Path("app/static/images/logo1.png"),
    ]

    for logo_path in logo_paths:
        if logo_path.exists():
            try:
                with open(logo_path, "rb") as f:
                    logo_data = f.read()
                    return base64.b64encode(logo_data).decode('utf-8')
            except Exception as e:
                print(f"Error reading logo from {logo_path}: {e}")
                pass
    return None


def format_date(value):
    """Format a date value safely"""
    if not value:
        return 'Not set'
    if hasattr(value, 'strftime'):
        return value.strftime('%d %B %Y')
    if isinstance(value, str):
        return value.split('T')[0] if 'T' in value else value
    return str(value)


def format_datetime(value):
    """Format a datetime value safely"""
    if not value:
        return 'Not set'
    if hasattr(value, 'strftime'):
        return value.strftime('%d %B %Y, %H:%M')
    if isinstance(value, str):
        return value.replace('T', ' ').split('.')[0]
    return str(value)


@router.get("/{meeting_id}/report", response_model=MeetingReportResponse)
async def generate_meeting_report_json(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Generate a comprehensive meeting report in JSON format"""

    from app.crud.action_tracker import meeting_crud
    meeting = await meeting_crud.get_meeting_with_details(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    history_query = select(MeetingStatusHistory).where(
        MeetingStatusHistory.meeting_id == meeting_id,
        MeetingStatusHistory.is_active == True
    ).order_by(MeetingStatusHistory.status_date)
    history_result = await db.execute(history_query)
    status_history = history_result.scalars().all()

    from app.crud.action_tracker import meeting_participant
    participants = await meeting_participant.get_by_meeting(db, meeting_id)

    minutes_query = select(MeetingMinutes).where(
        MeetingMinutes.meeting_id == meeting_id,
        MeetingMinutes.is_active == True
    ).order_by(MeetingMinutes.timestamp)
    minutes_result = await db.execute(minutes_query)
    minutes = minutes_result.scalars().all()

    actions = []
    for minute in minutes:
        if minute.actions:
            for action in minute.actions:
                actions.append(action)

    now = datetime.now()

    statistics = {
        "total_participants": len(participants),
        "chairperson_count": sum(1 for p in participants if p.is_chairperson),
        "attending_count": sum(1 for p in participants if p.attendance_status == 'attending'),
        "excused_count": sum(1 for p in participants if p.attendance_status == 'excused'),
        "absent_count": sum(1 for p in participants if p.attendance_status == 'absent'),
        "total_minutes": len(minutes),
        "total_actions": len(actions),
        "completed_actions": sum(1 for a in actions if getattr(a, 'is_completed', False) == True),
        "pending_actions": sum(1 for a in actions if getattr(a, 'is_completed', False) == False),
        "overdue_actions": sum(1 for a in actions if hasattr(a, 'due_date') and a.due_date and a.due_date < now and not getattr(a, 'is_completed', False))
    }

    report = MeetingReportResponse(
        id=meeting.id,
        title=meeting.title,
        description=meeting.description,
        meeting_date=meeting.meeting_date,
        start_time=meeting.start_time,
        end_time=meeting.end_time,
        location_id=meeting.location_id,
        location_text=meeting.location_text,
        location_hierarchy=[],
        venue=getattr(meeting, 'venue', None),
        address=getattr(meeting, 'address', None),
        gps_coordinates=meeting.gps_coordinates,
        platform=getattr(meeting, 'platform', None),
        meeting_link=getattr(meeting, 'meeting_link', None),
        meeting_id_online=getattr(meeting, 'meeting_id_online', None),
        passcode=getattr(meeting, 'passcode', None),
        chairperson_name=meeting.chairperson_name,
        facilitator=meeting.facilitator,
        status={
            "code": meeting.status.code if meeting.status else None,
            "name": meeting.status.name if meeting.status else None,
            "short_name": meeting.status.short_name if meeting.status else None,
            "color": getattr(meeting.status, 'color', '#6B7280')
        } if meeting.status else {
            "code": None,
            "name": "Pending",
            "short_name": "pending",
            "color": "#F59E0B"
        },
        status_history=[{
            "status": h.status.code if h.status else None,
            "comment": h.comment,
            "status_date": h.status_date,
            "changed_by": h.created_by.username if h.created_by else None,
            "changed_at": h.created_at
        } for h in status_history],
        agenda=meeting.agenda,
        statistics=statistics,
        participants=[MeetingReportParticipant(
            id=p.id,
            name=p.name,
            email=p.email,
            telephone=p.telephone,
            title=p.title,
            organization=p.organization,
            is_chairperson=p.is_chairperson,
            is_secretary=getattr(p, 'is_secretary', False),
            attendance_status=p.attendance_status
        ) for p in participants],
        minutes=[MeetingReportMinute(
            id=m.id,
            topic=m.topic,
            discussion=m.discussion,
            decisions=m.decisions,
            timestamp=m.timestamp,
            actions=[{
                "id": a.id,
                "action_item": getattr(a, 'description', getattr(a, 'action_item', '')),
                "responsible_person": getattr(a, 'responsible', getattr(a, 'responsible_person', '')),
                "due_date": getattr(a, 'due_date', None),
                "status": "completed" if getattr(a, 'is_completed', False) else "pending",
                "completion_notes": getattr(a, 'completion_notes', getattr(a, 'notes', None))
            } for a in (m.actions or [])]
        ) for m in minutes],
        actions=[MeetingReportAction(
            id=a.id,
            action_item=getattr(a, 'description', getattr(a, 'action_item', '')),
            responsible_person=getattr(a, 'responsible', getattr(a, 'responsible_person', '')),
            due_date=getattr(a, 'due_date', None),
            status="completed" if getattr(a, 'is_completed', False) else "pending",
            completion_notes=getattr(a, 'completion_notes', getattr(a, 'notes', None))
        ) for a in actions],
        created_by_name=meeting.created_by.username if meeting.created_by else None,
        created_at=meeting.created_at,
        updated_by_name=meeting.updated_by.username if meeting.updated_by else None,
        updated_at=meeting.updated_at,
        generated_at=now,
        generated_by=f"{current_user.first_name} {current_user.last_name}".strip() or current_user.username
    )

    return report


@router.get("/{meeting_id}/report/pdf")
async def generate_meeting_report_pdf(
    meeting_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Generate a comprehensive meeting report as PDF"""

    report = await generate_meeting_report_json(meeting_id, db, current_user)
    html_content = generate_report_html(report)

    try:
        from weasyprint import HTML
        pdf_file = BytesIO()
        HTML(string=html_content, base_url="").write_pdf(pdf_file)
        pdf_file.seek(0)
    except ImportError:
        return Response(
            content=html_content,
            media_type="text/html",
            headers={
                "Content-Disposition": f"inline; filename=meeting_report_{meeting_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            }
        )
    except Exception as e:
        print(f"PDF generation error: {e}")
        return Response(
            content=html_content,
            media_type="text/html",
            headers={
                "Content-Disposition": f"inline; filename=meeting_report_{meeting_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            }
        )

    return Response(
        content=pdf_file.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=meeting_report_{meeting_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        }
    )


def _attendance_badge(status: str) -> str:
    """Return styled HTML badge for attendance status"""
    mapping = {
        'attending': ('attending-badge', '&#10003; Attending'),
        'excused':   ('excused-badge',   '&#9675; Excused'),
        'absent':    ('absent-badge',    '&#10007; Absent'),
    }
    cls, label = mapping.get(status, ('pending-badge', 'Pending'))
    return f'<span class="badge {cls}">{label}</span>'


def _action_status_badge(status: str) -> str:
    """Return styled HTML badge for action status"""
    if status == 'completed':
        return '<span class="badge completed-badge">&#10003; Completed</span>'
    return '<span class="badge pending-badge">&#9675; Pending</span>'


def generate_report_html(report: MeetingReportResponse) -> str:
    """Generate complete professional HTML content for the meeting report"""

    meeting_date = format_date(report.meeting_date)
    start_time = report.start_time.strftime("%I:%M %p") if report.start_time else "Not set"
    end_time = report.end_time.strftime("%I:%M %p") if report.end_time else "Not set"

    status_colors = {
        'pending':     '#D97706',
        'started':     '#2563EB',
        'ongoing':     '#2563EB',
        'in_progress': '#2563EB',
        'ended':       '#059669',
        'closed':      '#059669',
        'cancelled':   '#DC2626',
    }
    status_short_name = report.status.get('short_name', '').lower() if report.status else ''
    status_color = status_colors.get(status_short_name, '#6B7280')
    status_name = report.status.get('name', 'Unknown') if report.status else 'Unknown'

    logo_base64 = get_logo_base64()
    logo_html = (
        f'<img src="data:image/png;base64,{logo_base64}" class="logo-img" alt="Logo"/>'
        if logo_base64
        else '<div class="logo-text">&#128203;</div>'
    )

    stats = report.statistics
    total = stats.get('total_actions', 0)
    completed = stats.get('completed_actions', 0)
    progress_pct = round((completed / total * 100) if total > 0 else 0)

    # ------------------------------------------------------------------ CSS --
    css = f"""
        @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

        :root {{
            --ink:        #1a1a2e;
            --ink-light:  #4a4a6a;
            --rule:       #d4d0c8;
            --paper:      #fafaf7;
            --accent:     #1a3a5c;
            --accent2:    #c8a96e;
            --success:    #0d6e4f;
            --warning:    #92400e;
            --danger:     #991b1b;
            --neutral:    #6B7280;
            --status-clr: {status_color};
        }}

        @page {{
            size: A4;
            margin: 2.2cm 2.5cm;
            @top-left   {{ content: "CONFIDENTIAL"; font-family: 'DM Sans', sans-serif; font-size: 7pt; color: #999; letter-spacing: 2px; }}
            @top-right  {{ content: string(doc-title); font-family: 'DM Sans', sans-serif; font-size: 7pt; color: #999; }}
            @bottom-center {{ content: "— " counter(page) " —"; font-family: 'EB Garamond', serif; font-size: 9pt; color: #aaa; }}
        }}

        * {{ box-sizing: border-box; margin: 0; padding: 0; }}

        body {{
            font-family: 'DM Sans', sans-serif;
            font-size: 9.5pt;
            line-height: 1.7;
            color: var(--ink);
            background: var(--paper);
        }}

        /* ── Cover / Header ── */
        .cover {{
            border-bottom: 3px solid var(--accent);
            padding-bottom: 24px;
            margin-bottom: 32px;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
        }}
        .cover-left {{ flex: 1; }}
        .cover-right {{ text-align: right; }}
        .logo-img {{ height: 52px; }}
        .logo-text {{ font-size: 32pt; }}
        .report-label {{
            font-family: 'DM Sans', sans-serif;
            font-size: 7pt;
            font-weight: 600;
            letter-spacing: 3px;
            text-transform: uppercase;
            color: var(--ink-light);
            margin-bottom: 6px;
        }}
        .report-title {{
            font-family: 'EB Garamond', serif;
            font-size: 22pt;
            font-weight: 600;
            color: var(--accent);
            line-height: 1.2;
            margin-bottom: 8px;
        }}
        .status-pill {{
            display: inline-block;
            background: var(--status-clr);
            color: #fff;
            font-size: 7.5pt;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            padding: 3px 12px;
            border-radius: 20px;
        }}
        .meta-line {{
            font-size: 8.5pt;
            color: var(--ink-light);
            margin-top: 6px;
        }}

        /* ── Section headings ── */
        h2 {{
            font-family: 'EB Garamond', serif;
            font-size: 13pt;
            font-weight: 600;
            color: var(--accent);
            border-bottom: 1.5px solid var(--accent2);
            padding-bottom: 4px;
            margin: 28px 0 14px;
            page-break-after: avoid;
            letter-spacing: 0.3px;
        }}
        h3 {{
            font-family: 'DM Sans', sans-serif;
            font-size: 10pt;
            font-weight: 600;
            color: var(--ink);
            margin: 14px 0 6px;
            page-break-after: avoid;
        }}

        /* ── Info grid ── */
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 20px;
        }}
        .info-card {{
            background: #fff;
            border: 1px solid var(--rule);
            border-top: 2.5px solid var(--accent2);
            padding: 10px 12px;
            border-radius: 3px;
        }}
        .info-label {{
            font-size: 7pt;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--ink-light);
            margin-bottom: 3px;
        }}
        .info-value {{
            font-size: 9.5pt;
            color: var(--ink);
            font-weight: 500;
        }}
        .info-value a {{ color: var(--accent); text-decoration: none; }}

        /* ── Statistics ── */
        .stat-row {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin: 14px 0 20px;
        }}
        .stat-box {{
            background: var(--accent);
            color: #fff;
            padding: 14px 12px;
            border-radius: 4px;
            text-align: center;
        }}
        .stat-box.light {{
            background: #fff;
            border: 1px solid var(--rule);
            color: var(--ink);
        }}
        .stat-num {{
            font-family: 'EB Garamond', serif;
            font-size: 20pt;
            font-weight: 600;
            display: block;
            line-height: 1.1;
        }}
        .stat-lbl {{
            font-size: 7.5pt;
            opacity: 0.85;
            display: block;
            margin-top: 2px;
        }}
        .progress-wrap {{
            background: #fff;
            border: 1px solid var(--rule);
            padding: 14px 16px;
            border-radius: 4px;
            margin-bottom: 20px;
        }}
        .progress-header {{
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            color: var(--ink-light);
            margin-bottom: 6px;
        }}
        .progress-bar-bg {{
            background: #e5e7eb;
            border-radius: 99px;
            height: 8px;
        }}
        .progress-bar-fill {{
            background: var(--success);
            border-radius: 99px;
            height: 8px;
            width: {progress_pct}%;
        }}

        /* ── Tables ── */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 16px;
            font-size: 8.5pt;
            page-break-inside: auto;
        }}
        thead tr {{ page-break-inside: avoid; page-break-after: avoid; }}
        th {{
            background: var(--accent);
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-weight: 500;
            font-size: 8pt;
            letter-spacing: 0.5px;
        }}
        th:first-child {{ border-radius: 3px 0 0 3px; }}
        th:last-child  {{ border-radius: 0 3px 3px 0; }}
        td {{
            padding: 7px 10px;
            border-bottom: 1px solid var(--rule);
            vertical-align: top;
        }}
        tr:last-child td {{ border-bottom: none; }}
        tr:nth-child(even) td {{ background: #f7f7f4; }}

        /* ── Badges ── */
        .badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 20px;
            font-size: 7.5pt;
            font-weight: 600;
            white-space: nowrap;
        }}
        .attending-badge  {{ background: #d1fae5; color: var(--success); }}
        .excused-badge    {{ background: #fef3c7; color: var(--warning); }}
        .absent-badge     {{ background: #fee2e2; color: var(--danger); }}
        .pending-badge    {{ background: #fef3c7; color: var(--warning); }}
        .completed-badge  {{ background: #d1fae5; color: var(--success); }}
        .overdue-badge    {{ background: #fee2e2; color: var(--danger); }}
        .role-badge {{
            display: inline-block;
            background: #ede9fe;
            color: #4c1d95;
            font-size: 7pt;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 20px;
            margin-left: 4px;
        }}

        /* ── Minutes cards ── */
        .minute-card {{
            border: 1px solid var(--rule);
            border-left: 4px solid var(--accent2);
            background: #fff;
            padding: 14px 16px;
            margin-bottom: 16px;
            border-radius: 0 4px 4px 0;
            page-break-inside: avoid;
        }}
        .minute-topic {{
            font-family: 'EB Garamond', serif;
            font-size: 12pt;
            font-weight: 600;
            color: var(--accent);
            margin-bottom: 2px;
        }}
        .minute-ts {{
            font-size: 7.5pt;
            color: var(--ink-light);
            margin-bottom: 10px;
        }}
        .minute-section-label {{
            font-size: 7.5pt;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            color: var(--ink-light);
            margin: 10px 0 4px;
        }}
        .minute-body {{ font-size: 9pt; color: var(--ink); }}

        /* ── Action items inline table ── */
        .action-table th {{ background: #334155; }}

        /* ── Agenda ── */
        .agenda-block {{
            background: #fff;
            border: 1px solid var(--rule);
            border-left: 4px solid var(--accent);
            padding: 12px 16px;
            font-size: 9pt;
            white-space: pre-wrap;
            border-radius: 0 4px 4px 0;
        }}

        /* ── Status history ── */
        .history-row td:first-child {{ font-weight: 600; }}

        /* ── Signature ── */
        .sig-section {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 50px;
            page-break-inside: avoid;
        }}
        .sig-block {{ text-align: center; }}
        .sig-line {{
            border-top: 1px solid #999;
            padding-top: 8px;
            margin-top: 36px;
            font-size: 8.5pt;
        }}
        .sig-name {{
            font-weight: 600;
            font-size: 9pt;
            color: var(--ink);
        }}
        .sig-role {{
            font-size: 8pt;
            color: var(--ink-light);
        }}

        /* ── Footer ── */
        .footer {{
            margin-top: 36px;
            border-top: 1px solid var(--rule);
            padding-top: 12px;
            text-align: center;
            font-size: 7.5pt;
            color: #aaa;
        }}
        .footer strong {{ color: var(--ink-light); }}

        .page-break {{ page-break-before: always; }}
        .no-break {{ page-break-inside: avoid; }}
    """

    # ----------------------------------------------------------------- HTML --
    h = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Meeting Report — {escape_html(report.title)}</title>
  <style>{css}</style>
</head>
<body>

<!-- ═══════════════════════════ COVER ═══════════════════════════ -->
<div class="cover">
  <div class="cover-left">
    {logo_html}
  </div>
  <div class="cover-right">
    <div class="report-label">Official Meeting Report</div>
    <div class="report-title">{escape_html(report.title)}</div>
    <div><span class="status-pill">{escape_html(status_name)}</span></div>
    <div class="meta-line">
      {meeting_date} &nbsp;·&nbsp; {start_time} – {end_time}
      {'&nbsp;·&nbsp;' + escape_html(report.location_text) if report.location_text else ''}
    </div>
  </div>
</div>

<!-- ═══════════════════════ MEETING INFO ════════════════════════ -->
<h2>Meeting Information</h2>
<div class="info-grid">
  <div class="info-card">
    <div class="info-label">Date</div>
    <div class="info-value">{meeting_date}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Time</div>
    <div class="info-value">{start_time} – {end_time}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Location</div>
    <div class="info-value">{escape_html(report.location_text or 'Not specified')}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Chairperson</div>
    <div class="info-value">{escape_html(report.chairperson_name or 'Not assigned')}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Secretary / Facilitator</div>
    <div class="info-value">{escape_html(report.facilitator or 'Not assigned')}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Prepared By</div>
    <div class="info-value">{escape_html(report.generated_by)}</div>
  </div>
"""

    if report.platform and report.platform.lower() != 'physical':
        h += f"""
  <div class="info-card">
    <div class="info-label">Platform</div>
    <div class="info-value">{escape_html(report.platform).upper()}</div>
  </div>
  <div class="info-card">
    <div class="info-label">Meeting Link</div>
    <div class="info-value"><a href="{escape_html(report.meeting_link or '')}">{escape_html(report.meeting_link or 'N/A')}</a></div>
  </div>
"""

    h += "</div>\n"

    # Description
    if report.description:
        h += f"""
<h2>Description</h2>
<div class="info-card" style="border-top-color: var(--accent); margin-bottom:20px;">
  <div class="info-value">{escape_html(report.description)}</div>
</div>
"""

    # ─────────────────────────── STATISTICS ──────────────────────────
    h += f"""
<h2>Summary Statistics</h2>
<div class="stat-row">
  <div class="stat-box">
    <span class="stat-num">{stats.get('total_participants', 0)}</span>
    <span class="stat-lbl">Total Participants</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">{stats.get('attending_count', 0)}</span>
    <span class="stat-lbl">Attending</span>
  </div>
  <div class="stat-box">
    <span class="stat-num">{stats.get('total_minutes', 0)}</span>
    <span class="stat-lbl">Agenda Items</span>
  </div>
  <div class="stat-box light">
    <span class="stat-num">{stats.get('overdue_actions', 0)}</span>
    <span class="stat-lbl" style="color:var(--danger);">Overdue Actions</span>
  </div>
</div>

<div class="progress-wrap">
  <div class="progress-header">
    <span>Action Items Progress</span>
    <span><strong>{completed}</strong> of <strong>{total}</strong> completed ({progress_pct}%)</span>
  </div>
  <div class="progress-bar-bg">
    <div class="progress-bar-fill"></div>
  </div>
</div>
"""

    # ─────────────────────────── AGENDA ──────────────────────────────
    if report.agenda:
        h += f"""
<h2>Meeting Agenda</h2>
<div class="agenda-block">{escape_html(report.agenda)}</div>
"""

    # ─────────────────────────── PARTICIPANTS ────────────────────────
    h += """
<h2>Participants</h2>
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Name</th>
      <th>Title / Organisation</th>
      <th>Email</th>
      <th>Attendance</th>
    </tr>
  </thead>
  <tbody>
"""
    for idx, p in enumerate(report.participants, 1):
        role_badges = ""
        if p.is_chairperson:
            role_badges += '<span class="role-badge">Chair</span>'
        if p.is_secretary:
            role_badges += '<span class="role-badge">Secretary</span>'

        org_line = ""
        if p.title and p.organization:
            org_line = f"{escape_html(p.title)}, {escape_html(p.organization)}"
        elif p.title:
            org_line = escape_html(p.title)
        elif p.organization:
            org_line = escape_html(p.organization)
        else:
            org_line = "—"

        h += f"""
    <tr>
      <td style="text-align:center; color:var(--ink-light); width:32px;">{idx}</td>
      <td>{escape_html(p.name)}{role_badges}</td>
      <td>{org_line}</td>
      <td style="color:var(--ink-light);">{escape_html(p.email or '—')}</td>
      <td>{_attendance_badge(p.attendance_status)}</td>
    </tr>
"""
    h += "  </tbody>\n</table>\n"

    # ─────────────────────────── MINUTES ─────────────────────────────
    if report.minutes:
        h += '<div class="page-break"></div>\n<h2>Meeting Minutes &amp; Decisions</h2>\n'
        for minute in report.minutes:
            h += f"""
<div class="minute-card">
  <div class="minute-topic">{escape_html(minute.topic)}</div>
  <div class="minute-ts">&#128197; {format_datetime(minute.timestamp)}</div>
"""
            if minute.discussion:
                h += f"""
  <div class="minute-section-label">Discussion</div>
  <div class="minute-body">{escape_html(minute.discussion)}</div>
"""
            if minute.decisions:
                h += f"""
  <div class="minute-section-label">Decisions Made</div>
  <div class="minute-body">{escape_html(minute.decisions)}</div>
"""
            # ── Action items rendered as HTML table (NOT escaped) ──
            if minute.actions:
                h += """
  <div class="minute-section-label">Action Items</div>
  <table class="action-table">
    <thead>
      <tr>
        <th>Action Item</th>
        <th>Responsible</th>
        <th>Due Date</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
"""
                for action in minute.actions:
                    due = format_date(action.get('due_date'))
                    status = action.get('status', 'pending')
                    # action_item rendered as HTML (supports rich text from editor)
                    action_html = action.get('action_item', '') or ''
                    resp = escape_html(action.get('responsible_person') or 'Unassigned')
                    h += f"""
      <tr>
        <td>{action_html}</td>
        <td>{resp}</td>
        <td style="white-space:nowrap;">{due}</td>
        <td>{_action_status_badge(status)}</td>
      </tr>
"""
                h += "    </tbody>\n  </table>\n"
            h += "</div>\n"

    # ─────────────────────────── ALL ACTIONS ─────────────────────────
    if report.actions:
        h += '<div class="page-break"></div>\n<h2>Complete Action Items Register</h2>\n'
        h += """
<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Action Item</th>
      <th>Responsible</th>
      <th>Due Date</th>
      <th>Status</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
"""
        for idx, action in enumerate(report.actions, 1):
            due = format_date(action.due_date)
            # action_item rendered as HTML
            action_html = action.action_item or ''
            resp = escape_html(action.responsible_person or 'Unassigned')
            notes = escape_html(action.completion_notes or '—')
            h += f"""
    <tr>
      <td style="text-align:center; color:var(--ink-light); width:32px;">{idx}</td>
      <td>{action_html}</td>
      <td>{resp}</td>
      <td style="white-space:nowrap;">{due}</td>
      <td>{_action_status_badge(action.status)}</td>
      <td style="color:var(--ink-light);">{notes}</td>
    </tr>
"""
        h += "  </tbody>\n</table>\n"

    # ─────────────────────────── STATUS HISTORY ──────────────────────
    if report.status_history:
        h += """
<h2>Status History</h2>
<table class="history-row">
  <thead>
    <tr>
      <th>Date</th>
      <th>Status</th>
      <th>Comment</th>
      <th>Changed By</th>
    </tr>
  </thead>
  <tbody>
"""
        for entry in report.status_history:
            h += f"""
    <tr>
      <td style="white-space:nowrap;">{format_date(entry.get('status_date'))}</td>
      <td>{escape_html(entry.get('status', 'Unknown'))}</td>
      <td>{escape_html(entry.get('comment') or '—')}</td>
      <td>{escape_html(entry.get('changed_by') or 'Unknown')}</td>
    </tr>
"""
        h += "  </tbody>\n</table>\n"

    # ─────────────────────────── SIGNATURES ──────────────────────────
    chair = escape_html(report.chairperson_name or '_______________________')
    sec   = escape_html(report.facilitator or '_______________________')
    h += f"""
<div class="sig-section">
  <div class="sig-block">
    <div class="sig-line">
      <div class="sig-name">{chair}</div>
      <div class="sig-role">Chairperson</div>
      <div style="margin-top:8px; font-size:8pt; color:var(--ink-light);">Date: _____________________</div>
    </div>
  </div>
  <div class="sig-block">
    <div class="sig-line">
      <div class="sig-name">{sec}</div>
      <div class="sig-role">Secretary</div>
      <div style="margin-top:8px; font-size:8pt; color:var(--ink-light);">Date: _____________________</div>
    </div>
  </div>
</div>

<!-- ═══════════════════════════ FOOTER ══════════════════════════ -->
<div class="footer">
  <p>Generated on <strong>{datetime.now().strftime('%d %B %Y at %I:%M %p')}</strong>
     &nbsp;·&nbsp; Prepared by <strong>{escape_html(report.generated_by)}</strong></p>
  <p>This is a system-generated document. For queries contact the meeting secretary.</p>
  <p style="margin-top:4px;">&copy; {datetime.now().year} Meeting Management System &nbsp;·&nbsp; CONFIDENTIAL</p>
</div>

</body>
</html>
"""
    return h