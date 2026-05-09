# app/api/v1/endpoints/users.py
from datetime import datetime
from typing import List, Optional
from uuid import UUID
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api import deps
from app.crud.user import user as user_crud
from app.crud.role import role as role_crud
from app.models.user import User
from app.models.role import Role
from app.models.meetings.organization import OrganizationNode
from app.models.meetings.user_department import UserDepartment, UserDepartmentRole, UserDepartmentStatus
from app.schemas.user import (
    BulkAssignDepartmentsRequest, BulkAssignUsersRequest, UserDepartmentCreate,
    UserDepartmentResponse, UserDepartmentUpdate, UserResponse, UserCreate,
    UserUpdate, UserWithRoles
)
from app.schemas.role import RoleResponse

# Configure logger
logger = logging.getLogger(__name__)

# Create routers
router = APIRouter()
department_router = APIRouter()

# ==================== Helper Functions ====================

async def validate_user_exists(db: AsyncSession, user_id: str) -> bool:
    """Validate that a user exists"""
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def validate_department_exists(db: AsyncSession, department_id: str) -> bool:
    """Validate that a department exists"""
    query = select(OrganizationNode).where(OrganizationNode.id == department_id)
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def check_duplicate_assignment(
    db: AsyncSession, 
    user_id: str, 
    department_id: str
) -> bool:
    """Check if a user-department assignment already exists"""
    query = select(UserDepartment).where(
        and_(
            UserDepartment.user_id == user_id,
            UserDepartment.department_id == department_id,
            UserDepartment.status != UserDepartmentStatus.INACTIVE
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def get_user_with_assignments(
    db: AsyncSession, 
    user_id: str,
    include_inactive: bool = False
) -> List[UserDepartment]:
    """Get user department assignments with eagerly loaded relationships"""
    query = select(UserDepartment).where(
        UserDepartment.user_id == user_id
    ).options(
        selectinload(UserDepartment.user),
        selectinload(UserDepartment.department)
    )
    
    if not include_inactive:
        query = query.where(UserDepartment.status == UserDepartmentStatus.ACTIVE)
    
    query = query.order_by(
        UserDepartment.is_primary.desc(),
        UserDepartment.created_at.desc()
    )
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_department_assignments(
    db: AsyncSession,
    department_id: str,
    role: Optional[str] = None,
    include_inactive: bool = False
) -> List[UserDepartment]:
    """Get department user assignments with eagerly loaded relationships"""
    query = select(UserDepartment).where(
        UserDepartment.department_id == department_id
    ).options(
        selectinload(UserDepartment.user),
        selectinload(UserDepartment.department)
    )
    
    if role:
        query = query.where(UserDepartment.role == role)
    
    if not include_inactive:
        query = query.where(UserDepartment.status == UserDepartmentStatus.ACTIVE)
    
    query = query.order_by(
        UserDepartment.is_primary.desc(),
        UserDepartment.created_at.desc()
    )
    
    result = await db.execute(query)
    return result.scalars().all()


def user_department_to_response(assignment: UserDepartment) -> UserDepartmentResponse:
    """Convert UserDepartment model to response model"""
    return UserDepartmentResponse(
        id=assignment.id,
        user_id=assignment.user_id,
        user_name=assignment.user.full_name if assignment.user else None,
        user_email=assignment.user.email if assignment.user else None,
        department_id=assignment.department_id,
        department_name=assignment.department.name if assignment.department else None,
        department_path=assignment.department.path if assignment.department else None,
        department_code=assignment.department.department_code if assignment.department else None,
        role=assignment.role,
        status=assignment.status,
        is_primary=assignment.is_primary,
        start_date=assignment.start_date.isoformat() if assignment.start_date else None,
        end_date=assignment.end_date.isoformat() if assignment.end_date else None,
        title=assignment.title,
        responsibilities=assignment.responsibilities or [],
        notes=assignment.notes,
        created_at=assignment.created_at.isoformat() if assignment.created_at else None,
        updated_at=assignment.updated_at.isoformat() if assignment.updated_at else None
    )


def validate_uuid(value: str, field_name: str = "ID") -> str:
    """Validate UUID format"""
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format: {value}"
        )


# ==================== User-Department Assignment Endpoints ====================

@router.post("/user-departments", response_model=UserDepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_user_department_assignment(
    assignment_data: UserDepartmentCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign a user to a department"""
    try:
        # Validate UUIDs
        validate_uuid(assignment_data.user_id, "User ID")
        validate_uuid(assignment_data.department_id, "Department ID")
        
        # Validate user exists
        if not await validate_user_exists(db, assignment_data.user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Validate department exists
        if not await validate_department_exists(db, assignment_data.department_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        # Check for duplicate active assignment
        if await check_duplicate_assignment(db, assignment_data.user_id, assignment_data.department_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already assigned to this department"
            )
        
        # Create assignment
        assignment = UserDepartment(
            user_id=assignment_data.user_id,
            department_id=assignment_data.department_id,
            role=assignment_data.role,
            status=assignment_data.status,
            is_primary=assignment_data.is_primary,
            start_date=assignment_data.start_date or datetime.utcnow(),
            end_date=assignment_data.end_date,
            title=assignment_data.title,
            responsibilities=assignment_data.responsibilities,
            notes=assignment_data.notes,
            created_by=assignment_data.created_by
        )
        
        # If this is primary, remove primary flag from other assignments for this user
        if assignment_data.is_primary:
            await db.execute(
                update(UserDepartment)
                .where(
                    UserDepartment.user_id == assignment_data.user_id,
                    UserDepartment.is_primary == True
                )
                .values(is_primary=False)
            )
        
        db.add(assignment)
        await db.commit()
        
        # Refresh with eagerly loaded relationships
        result = await db.execute(
            select(UserDepartment)
            .where(UserDepartment.id == assignment.id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        assignment = result.scalar_one()
        
        return user_department_to_response(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/user-departments", response_model=List[UserDepartmentResponse])
async def get_user_department_assignments(
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    department_id: Optional[str] = Query(None, description="Filter by department ID"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status"),
    is_primary: Optional[bool] = Query(None, description="Filter by primary status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get user-department assignments with filters"""
    try:
        query = select(UserDepartment).options(
            selectinload(UserDepartment.user),
            selectinload(UserDepartment.department)
        )
        
        if user_id:
            validate_uuid(user_id, "User ID")
            query = query.where(UserDepartment.user_id == user_id)
        
        if department_id:
            validate_uuid(department_id, "Department ID")
            query = query.where(UserDepartment.department_id == department_id)
        
        if role:
            query = query.where(UserDepartment.role == role)
        
        if status:
            query = query.where(UserDepartment.status == status)
        
        if is_primary is not None:
            query = query.where(UserDepartment.is_primary == is_primary)
        
        query = query.offset(skip).limit(limit).order_by(
            UserDepartment.is_primary.desc(),
            UserDepartment.created_at.desc()
        )
        
        result = await db.execute(query)
        assignments = result.scalars().all()
        
        return [user_department_to_response(a) for a in assignments]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching assignments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/user-departments/{assignment_id}", response_model=UserDepartmentResponse)
async def get_user_department_assignment(
    assignment_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Get a specific user-department assignment by ID"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        
        query = select(UserDepartment).where(
            UserDepartment.id == assignment_id
        ).options(
            selectinload(UserDepartment.user),
            selectinload(UserDepartment.department)
        )
        
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        return user_department_to_response(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.put("/user-departments/{assignment_id}", response_model=UserDepartmentResponse)
async def update_user_department_assignment(
    assignment_id: str,
    update_data: UserDepartmentUpdate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Update a user-department assignment"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        
        # Get the assignment with relationships
        query = select(UserDepartment).where(
            UserDepartment.id == assignment_id
        ).options(
            selectinload(UserDepartment.user),
            selectinload(UserDepartment.department)
        )
        
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        
        # Handle is_primary update - ensure only one primary per user
        if update_dict.get('is_primary') and not assignment.is_primary:
            await db.execute(
                update(UserDepartment)
                .where(
                    UserDepartment.user_id == assignment.user_id,
                    UserDepartment.is_primary == True,
                    UserDepartment.id != assignment_id
                )
                .values(is_primary=False)
            )
        
        for field, value in update_dict.items():
            setattr(assignment, field, value)
        
        assignment.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(assignment)
        
        return user_department_to_response(assignment)
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/user-departments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_department_assignment(
    assignment_id: str,
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
    db: AsyncSession = Depends(deps.get_db)
):
    """Delete a user-department assignment"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        
        query = select(UserDepartment).where(UserDepartment.id == assignment_id)
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignment not found"
            )
        
        if hard_delete:
            await db.delete(assignment)
        else:
            assignment.status = UserDepartmentStatus.INACTIVE
            assignment.end_date = datetime.utcnow()
        
        await db.commit()
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting assignment: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ==================== User-specific Department Endpoints ====================

@router.post("/users/{user_id}/departments", response_model=List[UserDepartmentResponse])
async def assign_user_to_departments(
    user_id: str,
    assign_data: BulkAssignDepartmentsRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign a user to multiple departments"""
    try:
        validate_uuid(user_id, "User ID")
        
        # Validate user exists
        if not await validate_user_exists(db, user_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        assignments = []
        created_assignments = []
        
        for dept_id in assign_data.department_ids:
            validate_uuid(dept_id, "Department ID")
            
            # Validate department exists
            if not await validate_department_exists(db, dept_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Department not found: {dept_id}"
                )
            
            # Check for duplicate
            if not await check_duplicate_assignment(db, user_id, dept_id):
                assignment = UserDepartment(
                    user_id=user_id,
                    department_id=dept_id,
                    role=assign_data.role,
                    is_primary=assign_data.is_primary,
                    start_date=datetime.utcnow()
                )
                db.add(assignment)
                assignments.append(assignment)
                created_assignments.append({
                    "user_id": user_id,
                    "department_id": dept_id,
                    "role": assign_data.role
                })
        
        # If setting primary, ensure only one primary
        if assign_data.is_primary and assignments:
            await db.execute(
                update(UserDepartment)
                .where(
                    UserDepartment.user_id == user_id,
                    UserDepartment.department_id.in_(assign_data.department_ids)
                )
                .values(is_primary=True)
            )
        
        await db.commit()
        
        # Refresh assignments with eager loading
        result = await db.execute(
            select(UserDepartment)
            .where(UserDepartment.user_id == user_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        refreshed_assignments = result.scalars().all()
        
        return [user_department_to_response(a) for a in refreshed_assignments]
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error bulk assigning departments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/users/{user_id}/departments", response_model=List[UserDepartmentResponse])
async def get_user_assigned_departments(
    user_id: str,
    include_inactive: bool = Query(False, description="Include inactive assignments"),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get all departments assigned to a user"""
    try:
        validate_uuid(user_id, "User ID")
        assignments = await get_user_with_assignments(db, user_id, include_inactive)
        return [user_department_to_response(a) for a in assignments]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user departments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/users/{user_id}/departments/{department_id}")
async def unlink_user_department(
    user_id: str,
    department_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Remove a department assignment from a user"""
    try:
        validate_uuid(user_id, "User ID")
        validate_uuid(department_id, "Department ID")
        
        query = select(UserDepartment).where(
            and_(
                UserDepartment.user_id == user_id,
                UserDepartment.department_id == department_id
            )
        )
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department assignment not found"
            )
        
        assignment.status = UserDepartmentStatus.INACTIVE
        assignment.end_date = datetime.utcnow()
        await db.commit()
        
        return {"message": "Department unlinked successfully", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error unlinking department: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ==================== Department-specific User Endpoints ====================

@router.post("/departments/{department_id}/users", response_model=List[UserDepartmentResponse])
async def assign_department_to_users(
    department_id: str,
    assign_data: BulkAssignUsersRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign multiple users to a department"""
    try:
        validate_uuid(department_id, "Department ID")
        
        # Validate department exists
        if not await validate_department_exists(db, department_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Department not found"
            )
        
        assignments = []
        
        for user_id in assign_data.user_ids:
            validate_uuid(user_id, "User ID")
            
            # Validate user exists
            if not await validate_user_exists(db, user_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User not found: {user_id}"
                )
            
            # Check for duplicate
            if not await check_duplicate_assignment(db, user_id, department_id):
                assignment = UserDepartment(
                    user_id=user_id,
                    department_id=department_id,
                    role=assign_data.role,
                    is_primary=assign_data.is_primary,
                    start_date=datetime.utcnow()
                )
                db.add(assignment)
                assignments.append(assignment)
        
        await db.commit()
        
        # Refresh assignments with eager loading
        result = await db.execute(
            select(UserDepartment)
            .where(UserDepartment.department_id == department_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        refreshed_assignments = result.scalars().all()
        
        return [user_department_to_response(a) for a in refreshed_assignments]
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error bulk assigning users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/departments/{department_id}/users", response_model=List[UserDepartmentResponse])
async def get_department_users(
    department_id: str,
    role: Optional[str] = Query(None, description="Filter by role"),
    include_inactive: bool = Query(False, description="Include inactive assignments"),
    db: AsyncSession = Depends(deps.get_db)
):
    """Get all users assigned to a department"""
    try:
        validate_uuid(department_id, "Department ID")
        assignments = await get_department_assignments(db, department_id, role, include_inactive)
        return [user_department_to_response(a) for a in assignments]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching department users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.delete("/departments/{department_id}/users/{user_id}")
async def unlink_department_user(
    department_id: str,
    user_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Remove a user from a department"""
    try:
        validate_uuid(department_id, "Department ID")
        validate_uuid(user_id, "User ID")
        
        query = select(UserDepartment).where(
            and_(
                UserDepartment.department_id == department_id,
                UserDepartment.user_id == user_id
            )
        )
        result = await db.execute(query)
        assignment = result.scalar_one_or_none()
        
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User assignment not found in this department"
            )
        
        assignment.status = UserDepartmentStatus.INACTIVE
        assignment.end_date = datetime.utcnow()
        await db.commit()
        
        return {"message": "User unlinked from department successfully", "success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error unlinking user from department: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# ==================== User Management Endpoints ====================

@router.get("/users/available", response_model=List[UserResponse])
async def get_available_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, email, or username"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> List[UserResponse]:
    """
    Get available users for adding to meetings.
    Accessible to any authenticated user.
    """
    query = select(User).where(User.is_active == True)
    
    if search and len(search.strip()) >= 2:
        search_term = f"%{search.strip()}%"
        search_filter = or_(
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.email.ilike(search_term),
            User.username.ilike(search_term),
            User.phone.ilike(search_term),
            func.concat(User.first_name, ' ', User.last_name).ilike(search_term)
        )
        query = query.where(search_filter)
    
    query = query.offset(skip).limit(limit).order_by(User.first_name, User.last_name)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email if user.id == current_user.id else 'xxxx',  # Hide email for other users
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            middle_name=user.middle_name,
            phone=user.phone if user.id == current_user.id else 'xxxx',  # Hide phone for other users
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]


@router.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True, description="Filter to only active users"),
    is_active: Optional[bool] = Query(None, description="Alias for active_only (overrides active_only if provided)"),
    search: Optional[str] = Query(None, description="Search by name, email, or username"),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> List[UserResponse]:
    """Get all users (admin only)"""
    filter_active = is_active if is_active is not None else active_only
    
    if filter_active:
        query = select(User).where(User.is_active == True)
    else:
        query = select(User)
    
    if search and len(search.strip()) >= 2:
        search_term = f"%{search.strip()}%"
        search_filter = or_(
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term),
            User.email.ilike(search_term),
            User.username.ilike(search_term),
            User.phone.ilike(search_term),
            func.concat(User.first_name, ' ', User.last_name).ilike(search_term)
        )
        query = query.where(search_filter)
    
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            middle_name=user.middle_name,
            phone=user.phone,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserWithRoles)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserWithRoles:
    """Get a specific user by ID (admin only)"""
    user = await user_crud.get_with_roles(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    roles = await user_crud.get_roles(db, user_id)
    
    return UserWithRoles(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=user.middle_name,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
        roles=[
            RoleResponse(
                id=role.id,
                name=role.name,
                code=role.code,
                description=role.description,
                is_system_role=role.is_system_role,
                priority=role.priority,
                created_at=role.created_at,
                updated_at=role.updated_at
            )
            for role in roles
        ]
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserResponse:
    """Update a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_data = user_data.model_dump(exclude_unset=True)
    updated_user = await user_crud.update(db, db_obj=user, obj_in=update_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    return UserResponse(
        id=updated_user.id,
        email=updated_user.email,
        username=updated_user.username,
        first_name=updated_user.first_name,
        last_name=updated_user.last_name,
        middle_name=updated_user.middle_name,
        phone=updated_user.phone,
        is_active=updated_user.is_active,
        is_verified=updated_user.is_verified,
        is_superuser=updated_user.is_superuser,
        created_at=updated_user.created_at,
        updated_at=updated_user.updated_at
    )


@router.delete("/users/{user_id}", response_model=dict)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Delete a user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    success = await user_crud.delete(db, id=user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )
    
    return {"message": "User deleted successfully"}


@router.post("/users/{user_id}/roles/{role_id}")
async def assign_role_to_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Assign a role to a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    success = await user_crud.add_role(db, user_id, role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign role"
        )
    
    return {"message": f"Role '{role.name}' assigned to user '{user.username}'"}


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Remove a role from a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    success = await user_crud.remove_role(db, user_id, role_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove role"
        )
    
    return {"message": f"Role '{role.name}' removed from user '{user.username}'"}


@router.get("/search")
async def search_users(
    search: str = Query(..., min_length=2, description="Search by name, email, or username"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Search for users by name, email, or username (excludes current user)"""
    search_term = f"%{search}%"
    
    query = select(User).where(
        User.id != current_user.id,
        User.is_active == True,
        or_(
            func.concat(User.first_name, ' ', User.last_name).ilike(search_term),
            User.username.ilike(search_term),
            User.email.ilike(search_term),
            User.first_name.ilike(search_term),
            User.last_name.ilike(search_term)
        )
    ).limit(limit)
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        {
            "id": str(user.id),
            "name": user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
            "email": user.email,
            "telephone": user.phone,
            "masked_email": _mask_email(user.email),
            "masked_telephone": _mask_phone(user.phone),
            "username": user.username
        }
        for user in users
    ]


@router.get("/by-id/{user_id}")
async def get_user_by_id(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Get user by ID with masked contact info"""
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user.id),
        "name": user.full_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
        "email": user.email,
        "telephone": user.phone,
        "masked_email": _mask_email(user.email),
        "masked_telephone": _mask_phone(user.phone),
        "username": user.username
    }


# ==================== Private Helper Functions ====================

def _mask_email(email: str) -> str:
    """Mask email for privacy"""
    if not email:
        return None
    parts = email.split('@')
    if len(parts) != 2:
        return email
    local, domain = parts
    if len(local) <= 3:
        masked_local = local[0] + '***'
    else:
        masked_local = local[:3] + '***' + local[-2:]
    return f"{masked_local}@{domain}"


def _mask_phone(phone: str) -> str:
    """Mask phone number for privacy"""
    if not phone:
        return None
    cleaned = ''.join(filter(str.isdigit, phone))
    if len(cleaned) <= 4:
        return '****'
    return '*' * (len(cleaned) - 4) + cleaned[-4:]