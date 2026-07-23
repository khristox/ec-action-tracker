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
    BulkAssignDepartmentsRequest, BulkAssignUsersRequest, DepartmentInfo, UserDepartmentCreate,
    UserDepartmentResponse, UserDepartmentUpdate, UserResponse, UserCreate,
    UserUpdate, UserWithRoles
)
from app.schemas.role import RoleResponse

logger = logging.getLogger(__name__)

router = APIRouter()
department_router = APIRouter()


# ==================== Helper Functions ====================

async def validate_user_exists(db: AsyncSession, user_id: str) -> bool:
    query = select(User).where(User.id == user_id)
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def validate_department_exists(db: AsyncSession, department_id: str) -> bool:
    query = select(OrganizationNode).where(OrganizationNode.id == department_id)
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None


async def check_duplicate_assignment(
    db: AsyncSession,
    user_id: str,
    department_id: str
) -> bool:
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
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format: {value}"
        )


def _mask_email(email: str) -> str:
    if not email:
        return None
    parts = email.split('@')
    if len(parts) != 2:
        return email
    local, domain = parts
    masked_local = local[0] + '***' if len(local) <= 3 else local[:3] + '***' + local[-2:]
    return f"{masked_local}@{domain}"


def _mask_phone(phone: str) -> str:
    if not phone:
        return None
    cleaned = ''.join(filter(str.isdigit, phone))
    if len(cleaned) <= 4:
        return '****'
    return '*' * (len(cleaned) - 4) + cleaned[-4:]


# ==============================================================================
# BLOCK 1 — /user-departments  (no path params → must come first)
# ==============================================================================

@router.post("/user-departments", response_model=UserDepartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_user_department_assignment(
    assignment_data: UserDepartmentCreate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign a user to a department"""
    try:
        validate_uuid(assignment_data.user_id, "User ID")
        validate_uuid(assignment_data.department_id, "Department ID")

        if not await validate_user_exists(db, assignment_data.user_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if not await validate_department_exists(db, assignment_data.department_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

        if await check_duplicate_assignment(db, assignment_data.user_id, assignment_data.department_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already assigned to this department")

        if assignment_data.is_primary:
            await db.execute(
                update(UserDepartment)
                .where(UserDepartment.user_id == assignment_data.user_id, UserDepartment.is_primary == True)
                .values(is_primary=False)
            )

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
        db.add(assignment)
        await db.commit()

        result = await db.execute(
            select(UserDepartment).where(UserDepartment.id == assignment.id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        return user_department_to_response(result.scalar_one())

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating assignment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.get("/user-departments", response_model=List[UserDepartmentResponse])
async def get_user_department_assignments(
    user_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_primary: Optional[bool] = Query(None),
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
        return [user_department_to_response(a) for a in result.scalars().all()]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching assignments: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.get("/user-departments/{assignment_id}", response_model=UserDepartmentResponse)
async def get_user_department_assignment(
    assignment_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Get a specific user-department assignment by ID"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        result = await db.execute(
            select(UserDepartment).where(UserDepartment.id == assignment_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        return user_department_to_response(assignment)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching assignment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.put("/user-departments/{assignment_id}", response_model=UserDepartmentResponse)
async def update_user_department_assignment(
    assignment_id: str,
    update_data: UserDepartmentUpdate,
    db: AsyncSession = Depends(deps.get_db)
):
    """Update a user-department assignment"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        result = await db.execute(
            select(UserDepartment).where(UserDepartment.id == assignment_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")

        update_dict = update_data.model_dump(exclude_unset=True)
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
        logger.error(f"Error updating assignment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.delete("/user-departments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_department_assignment(
    assignment_id: str,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(deps.get_db)
):
    """Delete a user-department assignment"""
    try:
        validate_uuid(assignment_id, "Assignment ID")
        result = await db.execute(select(UserDepartment).where(UserDepartment.id == assignment_id))
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
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
        logger.error(f"Error deleting assignment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# ==============================================================================
# BLOCK 2 — /users  static sub-paths (no {user_id} param → must come before
#            any route that starts with /{user_id})
# ==============================================================================

@router.get("/available", response_model=List[UserResponse])
async def get_available_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> List[UserResponse]:
    """Get available users for meeting assignment (any authenticated user)"""
    query = select(User).where(User.is_active == True)
    if search and len(search.strip()) >= 2:
        t = f"%{search.strip()}%"
        query = query.where(or_(
            User.first_name.ilike(t), User.last_name.ilike(t),
            User.email.ilike(t), User.username.ilike(t), User.phone.ilike(t),
            func.concat(User.first_name, ' ', User.last_name).ilike(t)
        ))
    query = query.offset(skip).limit(limit).order_by(User.first_name, User.last_name)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            first_name=user.first_name, last_name=user.last_name, middle_name=user.middle_name,
            phone=user.phone if user.id == current_user.id else 'xxxx',
            is_active=user.is_active, is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            created_at=user.created_at, updated_at=user.updated_at
        )
        for user in users
    ]


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    active_only: bool = Query(True),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    include_departments: bool = Query(True),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> List[UserResponse]:
    """Get all users (admin only)"""
    from sqlalchemy.orm import selectinload
    
    filter_active = is_active if is_active is not None else active_only
    
    query = select(User)
    
    if include_departments:
        query = query.options(
            selectinload(User.user_departments).selectinload(UserDepartment.department)
        )
    
    if filter_active:
        query = query.where(User.is_active == True)
    
    if search and len(search.strip()) >= 2:
        t = f"%{search.strip()}%"
        query = query.where(or_(
            User.first_name.ilike(t), 
            User.last_name.ilike(t),
            User.email.ilike(t), 
            User.username.ilike(t), 
            User.phone.ilike(t),
            func.concat(User.first_name, ' ', User.last_name).ilike(t)
        ))
    
    query = query.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return [
        UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            middle_name=u.middle_name,
            phone=u.phone,
            is_active=u.is_active,
            is_verified=u.is_verified,
            is_superuser=u.is_superuser,
            created_at=u.created_at,
            updated_at=u.updated_at,
            departments=[
                DepartmentInfo(
                    id=ud.department.id,
                    name=ud.department.name,
                    code=ud.department.department_code,
                    role=ud.role,
                    is_primary=ud.is_primary
                )
                for ud in u.user_departments 
                if ud.department and ud.status == "active"
            ] if include_departments else []
        )
        for u in users
    ]

# ==============================================================================
# BLOCK 3 — /search and /by-id/{user_id}  (static prefix, no / prefix
#            so no ordering conflict, but kept together for clarity)
# ==============================================================================

@router.get("/search")
async def search_users(
    search: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
):
    """Search for users by name, email, or username (excludes current user)"""
    t = f"%{search}%"
    query = select(User).where(
        User.id != current_user.id,
        User.is_active == True,
        or_(
            func.concat(User.first_name, ' ', User.last_name).ilike(t),
            User.username.ilike(t), User.email.ilike(t),
            User.first_name.ilike(t), User.last_name.ilike(t)
        )
    ).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "name": u.full_name or f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username,
            "email": u.email, "telephone": u.phone,
            "masked_email": _mask_email(u.email),
            "masked_telephone": _mask_phone(u.phone),
            "username": u.username
        }
        for u in users
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
        "email": user.email, "telephone": user.phone,
        "masked_email": _mask_email(user.email),
        "masked_telephone": _mask_phone(user.phone),
        "username": user.username
    }


# ==============================================================================
# BLOCK 4 — /departments/{department_id}/...  (static prefix "departments")
# ==============================================================================

@router.post("/departments/{department_id}/users", response_model=List[UserDepartmentResponse])
async def assign_department_to_users(
    department_id: str,
    assign_data: BulkAssignUsersRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign multiple users to a department"""
    try:
        validate_uuid(department_id, "Department ID")
        if not await validate_department_exists(db, department_id):
            raise HTTPException(status_code=404, detail="Department not found")

        for user_id in assign_data.user_ids:
            validate_uuid(user_id, "User ID")
            if not await validate_user_exists(db, user_id):
                raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
            if not await check_duplicate_assignment(db, user_id, department_id):
                db.add(UserDepartment(
                    user_id=user_id, department_id=department_id,
                    role=assign_data.role, is_primary=assign_data.is_primary,
                    start_date=datetime.utcnow()
                ))
        await db.commit()

        result = await db.execute(
            select(UserDepartment).where(UserDepartment.department_id == department_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        return [user_department_to_response(a) for a in result.scalars().all()]

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error bulk assigning users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.get("/departments/{department_id}/users", response_model=List[UserDepartmentResponse])
async def get_department_users(
    department_id: str,
    role: Optional[str] = Query(None),
    include_inactive: bool = Query(False),
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
        logger.error(f"Error fetching department users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.delete("/departments/{department_id}/{user_id}")
async def unlink_department_user(
    department_id: str,
    user_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Remove a user from a department"""
    try:
        validate_uuid(department_id, "Department ID")
        validate_uuid(user_id, "User ID")
        result = await db.execute(
            select(UserDepartment).where(
                and_(UserDepartment.department_id == department_id, UserDepartment.user_id == user_id)
            )
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=404, detail="User assignment not found in this department")
        assignment.status = UserDepartmentStatus.INACTIVE
        assignment.end_date = datetime.utcnow()
        await db.commit()
        return {"message": "User unlinked from department successfully", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error unlinking user from department: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


# ==============================================================================
# BLOCK 5 — /{user_id}/...  ALL parameterized user routes LAST
#            Order within this block: most-specific paths before less-specific.
#            /{user_id}/departments/{department_id}  before  /{user_id}/departments
#            /{user_id}/roles/{role_id}              before  /{user_id}
# ==============================================================================

@router.post("/{user_id}/departments", response_model=List[UserDepartmentResponse])
async def assign_user_to_departments(
    user_id: str,
    assign_data: BulkAssignDepartmentsRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    """Assign a user to multiple departments"""
    try:
        validate_uuid(user_id, "User ID")
        if not await validate_user_exists(db, user_id):
            raise HTTPException(status_code=404, detail="User not found")

        for dept_id in assign_data.department_ids:
            validate_uuid(dept_id, "Department ID")
            if not await validate_department_exists(db, dept_id):
                raise HTTPException(status_code=404, detail=f"Department not found: {dept_id}")
            if not await check_duplicate_assignment(db, user_id, dept_id):
                db.add(UserDepartment(
                    user_id=user_id, department_id=dept_id,
                    role=assign_data.role, is_primary=assign_data.is_primary,
                    start_date=datetime.utcnow()
                ))

        if assign_data.is_primary:
            await db.execute(
                update(UserDepartment)
                .where(
                    UserDepartment.user_id == user_id,
                    UserDepartment.department_id.in_(assign_data.department_ids)
                )
                .values(is_primary=True)
            )
        await db.commit()

        result = await db.execute(
            select(UserDepartment).where(UserDepartment.user_id == user_id)
            .options(selectinload(UserDepartment.user), selectinload(UserDepartment.department))
        )
        return [user_department_to_response(a) for a in result.scalars().all()]

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error bulk assigning departments: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.get("/{user_id}/departments", response_model=List[UserDepartmentResponse])
async def get_user_assigned_departments(
    user_id: str,
    include_inactive: bool = Query(False),
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
        logger.error(f"Error fetching user departments: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.delete("/{user_id}/departments/{department_id}")
async def unlink_user_department(
    user_id: str,
    department_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """Remove a department assignment from a user"""
    try:
        validate_uuid(user_id, "User ID")
        validate_uuid(department_id, "Department ID")
        result = await db.execute(
            select(UserDepartment).where(
                and_(UserDepartment.user_id == user_id, UserDepartment.department_id == department_id)
            )
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            raise HTTPException(status_code=404, detail="Department assignment not found")
        assignment.status = UserDepartmentStatus.INACTIVE
        assignment.end_date = datetime.utcnow()
        await db.commit()
        return {"message": "Department unlinked successfully", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error unlinking department: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")


@router.post("/{user_id}/roles/{role_id}")
async def assign_role_to_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Assign a role to a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    success = await user_crud.add_role(db, user_id, role_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to assign role")
    return {"message": f"Role '{role.name}' assigned to user '{user.username}'"}


@router.delete("/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Remove a role from a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    role = await role_crud.get(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    success = await user_crud.remove_role(db, user_id, role_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove role")
    return {"message": f"Role '{role.name}' removed from user '{user.username}'"}


@router.get("/{user_id}", response_model=UserWithRoles)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserWithRoles:
    """Get a specific user by ID (admin only)"""
    user = await user_crud.get_with_roles(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    roles = await user_crud.get_roles(db, user_id)
    return UserWithRoles(
        id=user.id, email=user.email, username=user.username,
        first_name=user.first_name, last_name=user.last_name, middle_name=user.middle_name,
        phone=user.phone, is_active=user.is_active, is_verified=user.is_verified,
        is_superuser=user.is_superuser, created_at=user.created_at, updated_at=user.updated_at,
        roles=[
            RoleResponse(
                id=r.id, name=r.name, code=r.code, description=r.description,
                is_system_role=r.is_system_role, priority=r.priority,
                created_at=r.created_at, updated_at=r.updated_at
            )
            for r in roles
        ]
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> UserResponse:
    """Update a user (admin only)"""
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated_user = await user_crud.update(db, db_obj=user, obj_in=user_data.model_dump(exclude_unset=True))
    if not updated_user:
        raise HTTPException(status_code=500, detail="Failed to update user")
    return UserResponse(
        id=updated_user.id, email=updated_user.email, username=updated_user.username,
        first_name=updated_user.first_name, last_name=updated_user.last_name,
        middle_name=updated_user.middle_name, phone=updated_user.phone,
        is_active=updated_user.is_active, is_verified=updated_user.is_verified,
        is_superuser=updated_user.is_superuser,
        created_at=updated_user.created_at, updated_at=updated_user.updated_at
    )


@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
) -> dict:
    """Delete a user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await user_crud.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    success = await user_crud.delete(db, id=user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete user")
    return {"message": "User deleted successfully"}