# app/crud/user.py
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.exc import SQLAlchemyError
from app.crud.base import CRUDBase
from app.models.user import User, user_roles  # Import from user.py
from app.models.role import Role  # Import Role from role.py
from app.schemas.user import UserCreate, UserUpdate
import logging

logger = logging.getLogger(__name__)


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    
    # ==================== BASIC CRUD OPERATIONS ====================
    
    async def get_by_username(
        self, 
        db: AsyncSession, 
        username: str,
        load_roles: bool = False
    ) -> Optional[User]:
        """
        Get a user by username.
        
        Args:
            db: Database session
            username: Username to look up
            load_roles: Whether to load roles eagerly
        """
        try:
            query = select(User).where(User.username == username)
            if load_roles:
                query = query.options(selectinload(User.roles))
            result = await db.execute(query)
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by username '{username}': {e}")
            return None
    
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get a user by email."""
        try:
            result = await db.execute(select(User).where(User.email == email))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by email '{email}': {e}")
            return None
    
    async def get_by_national_id(self, db: AsyncSession, national_id: str) -> Optional[User]:
        """Get a user by national ID."""
        try:
            result = await db.execute(select(User).where(User.national_id == national_id))
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user by national ID '{national_id}': {e}")
            return None
    
    # ==================== AUTHENTICATION ====================
    
    async def authenticate(
        self, 
        db: AsyncSession, 
        username: str, 
        password: str,
        load_roles: bool = False
    ) -> Optional[User]:
        """
        Authenticate a user by username/email and password.
        
        Args:
            db: Database session
            username: Username or email to authenticate
            password: Plain text password to verify
            load_roles: Whether to load roles after authentication
            
        Returns:
            User object if authentication successful, None otherwise
        """
        from app.core.security import verify_password
        
        try:
            # Try by username first, then by email
            user = await self.get_by_username(db, username)
            if not user:
                user = await self.get_by_email(db, username)
            
            if not user:
                logger.warning(f"Authentication failed: User '{username}' not found")
                return None
            
            # Check if user is active
            if not user.is_active:
                logger.warning(f"Authentication failed: User '{username}' is inactive")
                return None
            
            # Verify password
            if not verify_password(password, user.hashed_password):
                logger.warning(f"Authentication failed: Invalid password for user '{username}'")
                return None
            
            # Load roles if requested
            if load_roles:
                user = await self.load_roles(db, user)
            
            # Update last login
            await self.update_last_login(db, user.id)
            
            logger.info(f"✅ User '{username}' authenticated successfully")
            return user
            
        except SQLAlchemyError as e:
            logger.error(f"Error during authentication for user '{username}': {e}")
            return None
            
    # ==================== ROLE MANAGEMENT ====================
    
    async def load_roles(self, db: AsyncSession, user: User) -> User:
        """
        Load roles for a user (eager load the roles relationship).
        
        Args:
            db: Database session
            user: User object to load roles for
            
        Returns:
            User with roles loaded
        """
        try:
            # Refresh the user with roles loaded
            result = await db.execute(
                select(User)
                .where(User.id == user.id)
                .options(selectinload(User.roles))
            )
            user_with_roles = result.scalar_one_or_none()
            
            if user_with_roles:
                return user_with_roles
            
            # Fallback: manually load roles
            if hasattr(user, 'roles'):
                await db.refresh(user, attribute_names=['roles'])
            
            return user
            
        except SQLAlchemyError as e:
            logger.error(f"Error loading roles for user {user.id}: {e}")
            return user
    
    async def get_roles(self, db: AsyncSession, user_id: UUID) -> List[Role]:
        """
        Get all roles assigned to a user.
        
        Args:
            db: Database session
            user_id: UUID of the user
            
        Returns:
            List of Role objects
        """
        try:
            result = await db.execute(
                select(Role)
                .join(user_roles)
                .where(user_roles.c.user_id == user_id)
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error getting roles for user {user_id}: {e}")
            return []
    
    async def add_role(self, db: AsyncSession, user_id: UUID, role_id: UUID) -> bool:
        """
        Add a role to a user.
        
        Args:
            db: Database session
            user_id: UUID of the user
            role_id: UUID of the role to add
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if already assigned
            existing = await db.scalar(
                select(user_roles).where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
            
            if existing:
                logger.info(f"User {user_id} already has role {role_id}")
                return True
            
            # Assign role
            await db.execute(
                user_roles.insert().values(
                    user_id=user_id, 
                    role_id=role_id,
                    assigned_at=datetime.utcnow()
                )
            )
            await db.commit()
            logger.info(f"✅ Added role {role_id} to user {user_id}")
            return True
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error adding role to user {user_id}: {e}")
            return False
    
    async def add_role_by_name(self, db: AsyncSession, user_id: UUID, role_name: str) -> bool:
        """
        Add a role to a user by role name.
        
        Args:
            db: Database session
            user_id: UUID of the user
            role_name: Name of the role to add
            
        Returns:
            True if successful, False otherwise
        """
        from app.crud.role import role as role_crud
        
        try:
            role_obj = await role_crud.get_by_name(db, role_name)
            if not role_obj:
                logger.warning(f"Role '{role_name}' not found")
                return False
            
            return await self.add_role(db, user_id, role_obj.id)
            
        except SQLAlchemyError as e:
            logger.error(f"Error adding role '{role_name}' to user {user_id}: {e}")
            return False
    
    async def remove_role(self, db: AsyncSession, user_id: UUID, role_id: UUID) -> bool:
        """
        Remove a role from a user.
        
        Args:
            db: Database session
            user_id: UUID of the user
            role_id: UUID of the role to remove
            
        Returns:
            True if successful, False otherwise
        """
        try:
            result = await db.execute(
                user_roles.delete().where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role_id
                )
            )
            await db.commit()
            
            if result.rowcount > 0:
                logger.info(f"✅ Removed role {role_id} from user {user_id}")
                return True
            else:
                logger.info(f"User {user_id} did not have role {role_id}")
                return True
                
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error removing role from user {user_id}: {e}")
            return False
    
    async def has_role(self, db: AsyncSession, user_id: UUID, role_code: str) -> bool:
        """
        Check if a user has a specific role by role code.
        
        Args:
            db: Database session
            user_id: UUID of the user
            role_code: Code of the role to check
            
        Returns:
            True if user has the role, False otherwise
        """
        try:
            result = await db.execute(
                select(Role.code)
                .join(user_roles)
                .where(
                    user_roles.c.user_id == user_id,
                    Role.code == role_code
                )
            )
            return result.scalar_one_or_none() is not None
            
        except SQLAlchemyError as e:
            logger.error(f"Error checking role for user {user_id}: {e}")
            return False
    
    async def get_user_with_roles(self, db: AsyncSession, user_id: UUID) -> Optional[User]:
        """
        Get a user with their roles eagerly loaded.
        
        Args:
            db: Database session
            user_id: UUID of the user
            
        Returns:
            User object with roles loaded
        """
        try:
            result = await db.execute(
                select(User)
                .where(User.id == user_id)
                .options(selectinload(User.roles))
            )
            return result.scalar_one_or_none()
        except SQLAlchemyError as e:
            logger.error(f"Error fetching user with roles {user_id}: {e}")
            return None
    
    # ==================== USER CREATION ====================
    
    async def create_with_roles(
        self, 
        db: AsyncSession, 
        **kwargs
    ) -> Optional[User]:
        """
        Create a new user with roles.
        Supports both old (obj_in) and new (individual parameters) signatures.
        """
        from app.core.security import get_password_hash
        
        try:
            # Handle old signature with obj_in
            if 'obj_in' in kwargs:
                obj_in = kwargs['obj_in']
                email = obj_in.email
                username = obj_in.username
                full_name = obj_in.full_name
                password = obj_in.password
                roles = getattr(obj_in, 'roles', None)
                is_verified = getattr(obj_in, 'is_verified', False)
            else:
                # New signature with individual parameters
                email = kwargs.get('email')
                username = kwargs.get('username')
                full_name = kwargs.get('full_name')
                password = kwargs.get('password')
                roles = kwargs.get('roles', [])
                is_verified = kwargs.get('is_verified', False)
            
            # Validate required fields
            if not all([email, username, full_name, password]):
                logger.error("Missing required fields for user creation")
                return None
            
            # Check if user exists
            existing = await self.get_by_username(db, username)
            if existing:
                logger.warning(f"User '{username}' already exists")
                return existing
            
            # Split full name
            name_parts = full_name.split()
            first_name = name_parts[0] if name_parts else ""
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
            
            # Create user
            user = User(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                hashed_password=get_password_hash(password),
                is_verified=is_verified,
                is_active=True
            )
            db.add(user)
            await db.flush()
            
            # Assign roles
            if roles:
                for role_name in roles:
                    await self.add_role_by_name(db, user.id, role_name)
            
            await db.commit()
            await db.refresh(user)
            logger.info(f"✅ Created user: {username}")
            return user
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error creating user '{kwargs.get('username', 'unknown')}': {e}")
            return None
    
    # ==================== USER UPDATES ====================
    
    async def update_last_login(self, db: AsyncSession, user_id: UUID) -> bool:
        """Update user's last login timestamp."""
        try:
            user = await self.get(db, user_id)
            if user:
                user.last_login = datetime.utcnow()
                db.add(user)
                await db.commit()
                return True
            return False
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error updating last login for user {user_id}: {e}")
            return False
    
    async def change_password(
        self, 
        db: AsyncSession, 
        user_id: UUID, 
        old_password: str, 
        new_password: str
    ) -> bool:
        """
        Change user password.
        
        Args:
            db: Database session
            user_id: User ID
            old_password: Current password
            new_password: New password to set
            
        Returns:
            True if password changed successfully, False otherwise
        """
        from app.core.security import get_password_hash, verify_password
        
        try:
            user = await self.get(db, user_id)
            if not user:
                logger.warning(f"User {user_id} not found")
                return False
            
            # Verify old password
            if not verify_password(old_password, user.hashed_password):
                logger.warning(f"Invalid old password for user {user_id}")
                return False
            
            # Update password
            user.hashed_password = get_password_hash(new_password)
            user.password_changed_at = datetime.utcnow()
            db.add(user)
            await db.commit()
            
            logger.info(f"✅ Password changed for user {user_id}")
            return True
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error changing password for user {user_id}: {e}")
            return False
    
    async def update_profile(
        self,
        db: AsyncSession,
        user_id: UUID,
        **kwargs
    ) -> Optional[User]:
        """
        Update user profile information.
        
        Args:
            db: Database session
            user_id: UUID of the user
            **kwargs: Fields to update
            
        Returns:
            Updated User object or None
        """
        try:
            user = await self.get(db, user_id)
            if not user:
                logger.warning(f"User {user_id} not found")
                return None
            
            # Allowed fields for profile update
            allowed_fields = [
                'first_name', 'last_name', 'middle_name', 'preferred_name',
                'primary_phone', 'secondary_phone', 'primary_email', 'secondary_email',
                'address_line1', 'address_line2', 'city', 'state_province', 
                'postal_code', 'country', 'profile_picture', 'bio',
                'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship'
            ]
            
            for field in allowed_fields:
                if field in kwargs and kwargs[field] is not None:
                    setattr(user, field, kwargs[field])
            
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info(f"✅ Profile updated for user {user_id}")
            return user
            
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error updating profile for user {user_id}: {e}")
            return None
    
    # ==================== USER STATUS MANAGEMENT ====================
    
    async def deactivate_user(self, db: AsyncSession, user_id: UUID) -> bool:
        """Deactivate a user account."""
        try:
            user = await self.get(db, user_id)
            if user:
                user.is_active = False
                db.add(user)
                await db.commit()
                logger.info(f"✅ User {user_id} deactivated")
                return True
            return False
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error deactivating user {user_id}: {e}")
            return False
    
    async def activate_user(self, db: AsyncSession, user_id: UUID) -> bool:
        """Activate a user account."""
        try:
            user = await self.get(db, user_id)
            if user:
                user.is_active = True
                db.add(user)
                await db.commit()
                logger.info(f"✅ User {user_id} activated")
                return True
            return False
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error activating user {user_id}: {e}")
            return False
    
    async def verify_user(self, db: AsyncSession, user_id: UUID) -> bool:
        """Mark a user as verified."""
        try:
            user = await self.get(db, user_id)
            if user:
                user.is_verified = True
                db.add(user)
                await db.commit()
                logger.info(f"✅ User {user_id} verified")
                return True
            return False
        except SQLAlchemyError as e:
            await db.rollback()
            logger.error(f"Error verifying user {user_id}: {e}")
            return False
    
    # ==================== QUERIES ====================
    
    async def get_active_users(
        self, 
        db: AsyncSession, 
        skip: int = 0, 
        limit: int = 100
    ) -> List[User]:
        """Get active users."""
        try:
            result = await db.execute(
                select(User)
                .where(User.is_active == True)
                .offset(skip)
                .limit(limit)
                .order_by(User.username)
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching active users: {e}")
            return []
    
    async def get_users_by_role(
        self, 
        db: AsyncSession, 
        role_code: str,
        skip: int = 0, 
        limit: int = 100
    ) -> List[User]:
        """Get users with a specific role."""
        try:
            result = await db.execute(
                select(User)
                .join(user_roles)
                .join(Role)
                .where(Role.code == role_code)
                .offset(skip)
                .limit(limit)
                .order_by(User.username)
            )
            return list(result.scalars().all())
        except SQLAlchemyError as e:
            logger.error(f"Error fetching users by role '{role_code}': {e}")
            return []
    
    async def count_users(self, db: AsyncSession, active_only: bool = True) -> int:
        """Count total users."""
        try:
            query = select(func.count()).select_from(User)
            if active_only:
                query = query.where(User.is_active == True)
            result = await db.execute(query)
            return result.scalar() or 0
        except SQLAlchemyError as e:
            logger.error(f"Error counting users: {e}")
            return 0


# Create a single instance
user = CRUDUser(User)