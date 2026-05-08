# utils/meeting_org_integration.py
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from crud.meetings.organization import OrganizationCRUD
from datetime import datetime

class MeetingOrganizationIntegration:
    """Integrate organization chart with meeting system"""
    
    def __init__(self, db: Session):
        self.db = db
        self.org_crud = OrganizationCRUD(db)
    
    async def get_meeting_participants_by_department(
        self, 
        department_id: int, 
        include_subdepartments: bool = True
    ) -> List[Dict[str, Any]]:
        """Get all team members from a department and its sub-departments"""
        participants = []
        
        # Get department
        department = self.org_crud.get_node(department_id)
        if not department:
            return []
        
        # Get all descendant departments if needed
        departments = [department]
        if include_subdepartments:
            descendants = self.org_crud.get_descendants(department_id)
            departments.extend(descendants)
        
        for dept in departments:
            # Fetch users from this department from your user service
            # This is a placeholder - replace with actual user query
            dept_users = await self._get_users_by_department(dept.id)
            participants.extend(dept_users)
        
        return participants
    
    async def get_meeting_approval_chain(
        self, 
        department_id: int, 
        include_current: bool = True
    ) -> List[Dict[str, Any]]:
        """Get approval chain based on organization hierarchy"""
        approval_chain = []
        
        if include_current:
            current_dept = self.org_crud.get_node(department_id)
            if current_dept:
                approval_chain.append({
                    'department_id': current_dept.id,
                    'department_name': current_dept.name,
                    'approver_title': current_dept.title,
                    'level': current_dept.level,
                    'email': current_dept.email,
                    'phone': current_dept.phone
                })
        
        # Get ancestors for approval
        ancestors = self.org_crud.get_ancestors(department_id)
        for ancestor in ancestors:
            approval_chain.append({
                'department_id': ancestor.id,
                'department_name': ancestor.name,
                'approver_title': ancestor.title,
                'level': ancestor.level,
                'email': ancestor.email,
                'phone': ancestor.phone
            })
        
        return approval_chain
    
    async def get_department_meeting_info(self, department_id: int) -> Dict[str, Any]:
        """Get meeting room and scheduling information for a department"""
        dept = self.org_crud.get_node(department_id)
        if not dept:
            return {}
        
        return {
            'department_id': dept.id,
            'department_name': dept.name,
            'department_code': dept.department_code,
            'location': dept.location,
            'default_meeting_room': f"Meeting Room - {dept.department_code or dept.name}",
            'budget_center': dept.department_code,
            'head_count': dept.employee_count,
            'contact_email': dept.email,
            'contact_phone': dept.phone,
            'hierarchy_level': dept.level
        }
    
    async def schedule_department_meeting(
        self, 
        department_id: int, 
        meeting_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Schedule a meeting with department hierarchy consideration"""
        dept = self.org_crud.get_node(department_id)
        if not dept:
            raise ValueError("Department not found")
        
        # Get hierarchy chain for notifications
        approval_chain = await self.get_meeting_approval_chain(department_id)
        
        # Get all relevant participants
        participants = await self.get_meeting_participants_by_department(department_id)
        
        # Determine notification strategy based on hierarchy level
        notification_strategy = self._get_notification_strategy(dept.level)
        
        return {
            'meeting_id': meeting_data.get('meeting_id'),
            'department_id': dept.id,
            'department_name': dept.name,
            'hierarchy_level': dept.level,
            'approval_chain': approval_chain,
            'participants_count': len(participants),
            'department_head': dept.title,
            'location': dept.location,
            'notification_strategy': notification_strategy,
            'suggested_room': f"Room {dept.department_code or dept.name}",
            'budget_code': dept.department_code
        }
    
    async def get_meeting_visibility_settings(self, department_id: int) -> Dict[str, Any]:
        """Get meeting visibility settings based on org hierarchy"""
        dept = self.org_crud.get_node(department_id)
        if not dept:
            return {}
        
        # Determine visibility based on level
        if dept.level == 0:  # Executive level
            visibility = "company_wide"
        elif dept.level == 1:  # Department level
            visibility = "department_and_above"
        else:  # Team level
            visibility = "team_only"
        
        return {
            'department_id': dept.id,
            'department_name': dept.name,
            'level': dept.level,
            'visibility': visibility,
            'can_schedule_for_descendants': dept.level <= 1,
            'requires_approval_from': [anc.id for anc in self.org_crud.get_ancestors(department_id)]
        }
    
    async def get_team_meeting_summary(self, department_id: int) -> Dict[str, Any]:
        """Get summary of team and sub-teams for meeting planning"""
        dept = self.org_crud.get_node_with_children(department_id)
        if not dept:
            return {}
        
        sub_teams = []
        for child in dept.children:
            if child.is_active:
                sub_teams.append({
                    'id': child.id,
                    'name': child.name,
                    'employee_count': child.employee_count,
                    'location': child.location
                })
        
        return {
            'main_team': {
                'id': dept.id,
                'name': dept.name,
                'head': dept.title,
                'total_members': dept.employee_count
            },
            'sub_teams': sub_teams,
            'total_sub_teams': len(sub_teams),
            'suggested_meeting_format': self._get_suggested_meeting_format(len(sub_teams), dept.employee_count)
        }
    
    def _get_notification_strategy(self, level: int) -> str:
        """Determine notification strategy based on hierarchy level"""
        if level == 0:
            return "notify_all_company"
        elif level == 1:
            return "notify_department_and_descendants"
        else:
            return "notify_team_only"
    
    def _get_suggested_meeting_format(self, sub_teams_count: int, total_members: int) -> str:
        """Suggest meeting format based on team size"""
        if total_members > 50:
            return "town_hall"
        elif sub_teams_count > 3:
            return "department_meeting"
        elif total_members > 10:
            return "team_meeting"
        else:
            return "standup"
    
    async def _get_users_by_department(self, department_id: int) -> List[Dict[str, Any]]:
        """Placeholder method - replace with actual user service integration"""
        # In your actual implementation, query your user table
        # This is just a sample
        return [
            {
                'user_id': 1,
                'name': 'John Doe',
                'email': 'john.doe@example.com',
                'position': 'Manager',
                'department_id': department_id
            }
        ]