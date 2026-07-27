"""
Department-Based Access Control for Meetings

This module implements granular access control based on:
1. Department membership (restricted_department_id)
2. Participant status
3. Creator status
4. Meeting visibility

Access Levels:
- FULL: Creator or in restricted department → Can see all tabs
- LIMITED: Participant in restricted meeting → Can see Overview, Actions, limited Participants
- NONE: No access
"""

import logging
from enum import Enum
from uuid import UUID
from typing import Optional
from app.models.meetings.action_tracker import Meeting
from app.models.meetings.user_department import UserDepartment
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)



class AccessLevel(str, Enum):
    """Access levels for department-based access control"""
    FULL = "full"
    LIMITED = "limited"
    NONE = "none"
 
class DepartmentAccessControl:
    """Department-based access control for meetings"""
    
    @staticmethod
    async def get_access_level(
        db: AsyncSession,
        meeting_id: UUID,
        user_id: UUID,
        user_email: str,
        is_superuser: bool = False
    ) -> AccessLevel:
        """
        Determine access level for user to a meeting.
        
        Returns:
        - FULL: User is creator OR in restricted department with ACTIVE status
        - LIMITED: User is participant (but not creator/dept member)
        - NONE: No access
        """
        
        logger.info(f"🔍 Checking access for user {user_id} ({user_email}) to meeting {meeting_id}")
        
        # Superuser always has full access
        """ if is_superuser:
            logger.info(f"✅ User is superuser → FULL access")
            return AccessLevel.FULL """
        
        try:
            # Fetch meeting with participants
            result = await db.execute(
                select(Meeting).options(
                    selectinload(Meeting.participants)
                ).where(Meeting.id == meeting_id)
            )
            meeting = result.scalar_one_or_none()
            
            if not meeting:
                logger.warning(f"❌ Meeting {meeting_id} not found")
                return AccessLevel.NONE
            
            logger.info(f"📋 Meeting found: restricted_dept={meeting.restricted_department_id}, visibility={meeting.visibility}, created_by={meeting.created_by_id}")
            
            # ==================== CASE 1: Restricted Department Meeting ====================
            if meeting.restricted_department_id:
                logger.info(f"🏢 This is a RESTRICTED department meeting (dept={meeting.restricted_department_id})")
                
                # Check if user is in the restricted department with ACTIVE status
                dept_result = await db.execute(
                    select(UserDepartment).where(
                        UserDepartment.user_id == user_id,
                        UserDepartment.department_id == meeting.restricted_department_id,
                        UserDepartment.status == 'active'  # ✅ MUST BE ACTIVE!
                    )
                )
                dept_member = dept_result.scalar_one_or_none()
                
                if dept_member:
                    logger.info(f"✅ User IS in restricted department with ACTIVE status → FULL access")
                    return AccessLevel.FULL
                else:
                    logger.warning(f"❌ User is NOT in restricted department with ACTIVE status (or status is inactive/member/etc)")
                
                # Check if user is a participant (even if not in department)
                if meeting.participants:
                    for p in meeting.participants:
                        if p.email == user_email and p.is_active:
                            logger.info(f"✅ User IS a participant in restricted meeting → LIMITED access")
                            return AccessLevel.LIMITED
                    logger.warning(f"❌ User is NOT a participant (checked {len(meeting.participants)} participants)")
                else:
                    logger.warning(f"❌ Meeting has no participants")
                
                # Not in department and not a participant = NO ACCESS
                logger.info(f"🚫 User has NO access to restricted meeting")
                return AccessLevel.NONE
            
            # ==================== CASE 2: Unrestricted (Open) Meeting ====================
            else:
                logger.info(f"🌐 This is an UNRESTRICTED meeting")
                
                # Check if creator
                if meeting.created_by_id == user_id:
                    logger.info(f"✅ User IS creator of unrestricted meeting → FULL access")
                    return AccessLevel.FULL
                
                # Check if participant
                if meeting.participants:
                    for p in meeting.participants:
                        if p.email == user_email and p.is_active:
                            logger.info(f"✅ User IS a participant in unrestricted meeting → LIMITED access")
                            return AccessLevel.LIMITED
                
                # Unrestricted meetings are visible to everyone
                if meeting.visibility == 'open':
                    logger.info(f"✅ Meeting visibility is 'open' → LIMITED access for everyone")
                    return AccessLevel.LIMITED
                
                logger.info(f"🚫 User has NO access to unrestricted meeting")
                return AccessLevel.NONE
        
        except Exception as e:
            logger.error(f"❌ Error determining access level: {e}", exc_info=True)
            return AccessLevel.NONE
    
    @staticmethod
    async def _user_in_department(
        db: AsyncSession,
        user_id: UUID,
        department_id: UUID
    ) -> bool:
        """
        Check if user is in department with ACTIVE status.
        ✅ Fixed: Now checks status == 'active'
        """
        result = await db.execute(
            select(UserDepartment).where(
                UserDepartment.user_id == user_id,
                UserDepartment.department_id == department_id,
                UserDepartment.status == 'active'  # ✅ CRITICAL FIX!
            )
        )
        return result.scalar_one_or_none() is not None
 
 
# ==================== HELPER FUNCTION ====================

async def check_meeting_access_or_403(
    db: AsyncSession,
    meeting_id: UUID,
    user_id: UUID,
    user_email: str,
    is_superuser: bool = False,
    required_level: AccessLevel = AccessLevel.FULL
) -> AccessLevel:
    """
    Check meeting access and raise 403 if not authorized.
    
    Returns the access level if authorized.
    Raises HTTPException(403) if not authorized.
    """
    level = await DepartmentAccessControl.get_access_level(
        db, meeting_id, user_id, user_email, is_superuser
    )
    
    if level not in [AccessLevel.FULL, required_level]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this resource"
        )
    
    return level