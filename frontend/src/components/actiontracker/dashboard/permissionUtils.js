/**
 * Permission Utilities - Role-Based Access Control (RBAC)
 * 
 * Handles checking if a user has specific permissions based on their roles
 * 
 * Structure:
 * - User has multiple roles
 * - Each role has multiple permissions (e.g., "meeting:create", "meeting:edit", etc.)
 * - Permission format: "resource:action" (e.g., "meeting:create", "user:delete")
 */

/**
 * Check if user has a specific permission
 * 
 * @param {Object} user - Current user object with roles
 * @param {string} permissionRequired - Permission to check (e.g., "meeting:create")
 * @param {Array} roles - Array of all available roles from Redux/API
 * @returns {boolean} - True if user has permission, false otherwise
 * 
 * @example
 * const canCreate = hasPermission(user, "meeting:create", rolesList);
 * if (canCreate) {
 *   // Show "Schedule a meeting" button
 * }
 */
export const hasPermission = (user, permissionRequired, roles = []) => {
  // If no user, deny access
  if (!user || !user.roles) return false;

  // Check if ANY of the user's roles have the required permission
  return user.roles.some((roleCode) => {
    // Find the role object by code
    const role = roles.find((r) => r.code === roleCode);
    
    if (!role) return false;

    // Check if this role has the required permission
    const permissions = role.permissions || [];
    return permissions.some((p) => p.code === permissionRequired || p === permissionRequired);
  });
};

/**
 * Check if user has ANY of the specified permissions
 * 
 * @param {Object} user - Current user object
 * @param {Array<string>} permissionsArray - Array of permissions (e.g., ["meeting:create", "meeting:edit"])
 * @param {Array} roles - Array of all roles
 * @returns {boolean} - True if user has at least one permission
 * 
 * @example
 * const canManageMeetings = hasAnyPermission(user, ["meeting:create", "meeting:edit"], rolesList);
 */
export const hasAnyPermission = (user, permissionsArray = [], roles = []) => {
  return permissionsArray.some((permission) => hasPermission(user, permission, roles));
};

/**
 * Check if user has ALL of the specified permissions
 * 
 * @param {Object} user - Current user object
 * @param {Array<string>} permissionsArray - Array of permissions
 * @param {Array} roles - Array of all roles
 * @returns {boolean} - True if user has all permissions
 * 
 * @example
 * const canApprove = hasAllPermissions(user, ["meeting:view", "meeting:approve"], rolesList);
 */
export const hasAllPermissions = (user, permissionsArray = [], roles = []) => {
  return permissionsArray.every((permission) => hasPermission(user, permission, roles));
};

/**
 * Get all permissions for a user based on their roles
 * 
 * @param {Object} user - Current user object
 * @param {Array} roles - Array of all roles
 * @returns {Array<string>} - Array of all permission codes the user has
 * 
 * @example
 * const userPermissions = getUserPermissions(user, rolesList);
 * // Returns: ["meeting:create", "meeting:view", "user:view", ...]
 */
export const getUserPermissions = (user, roles = []) => {
  if (!user || !user.roles) return [];

  const permissions = new Set();

  user.roles.forEach((roleCode) => {
    const role = roles.find((r) => r.code === roleCode);
    if (role && role.permissions) {
      role.permissions.forEach((p) => {
        const permCode = typeof p === 'string' ? p : p.code;
        permissions.add(permCode);
      });
    }
  });

  return Array.from(permissions);
};

/**
 * Create a permission checker hook for React components
 * 
 * @param {Object} user - Current user
 * @param {Array} roles - All available roles
 * @returns {Object} - Object with permission checking methods
 * 
 * @example
 * const perms = usePermissions(user, rolesList);
 * if (perms.can("meeting:create")) {
 *   // Render button
 * }
 */
export const createPermissionChecker = (user, roles = []) => ({
  can: (permission) => hasPermission(user, permission, roles),
  canAny: (permissions) => hasAnyPermission(user, permissions, roles),
  canAll: (permissions) => hasAllPermissions(user, permissions, roles),
  all: () => getUserPermissions(user, roles),
  has: (permission) => hasPermission(user, permission, roles), // Alias
});

/**
 * Permission constants - Define all permissions used in the app
 */
export const PERMISSIONS = {
  // Meeting permissions
  MEETING_CREATE: "meeting:create",
  MEETING_VIEW: "meeting:view",
  MEETING_EDIT: "meeting:edit",
  MEETING_DELETE: "meeting:delete",
  MEETING_APPROVE: "meeting:approve",
  MEETING_CLOSE: "meeting:close",
  MEETING_EXPORT: "meeting:export",

  // User permissions
  USER_CREATE: "user:create",
  USER_VIEW: "user:view",
  USER_EDIT: "user:edit",
  USER_DELETE: "user:delete",
  USER_MANAGE_ROLES: "user:manage_roles",

  // Admin permissions
  ADMIN_ACCESS: "admin:access",
  ADMIN_SETTINGS: "admin:settings",
  ADMIN_REPORTS: "admin:reports",

  // Action/Task permissions
  ACTION_CREATE: "action:create",
  ACTION_EDIT: "action:edit",
  ACTION_DELETE: "action:delete",

  // Department permissions
  DEPARTMENT_VIEW: "department:view",
  DEPARTMENT_MANAGE: "department:manage",
};

/**
 * Verify if roles data structure is valid
 * 
 * @param {Array} roles - Array of roles
 * @returns {boolean} - True if valid
 */
export const validateRolesStructure = (roles = []) => {
  return Array.isArray(roles) && roles.every((role) => {
    return (
      role.code &&
      role.name &&
      Array.isArray(role.permissions)
    );
  });
};

/**
 * Get roles that have a specific permission
 * 
 * @param {string} permission - Permission code
 * @param {Array} roles - All roles
 * @returns {Array} - Roles that have this permission
 * 
 * @example
 * const canCreateMeetingRoles = getRolesWithPermission("meeting:create", rolesList);
 */
export const getRolesWithPermission = (permission, roles = []) => {
  return roles.filter((role) => {
    const perms = role.permissions || [];
    return perms.some((p) => (typeof p === 'string' ? p : p.code) === permission);
  });
};

export default {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  createPermissionChecker,
  PERMISSIONS,
  validateRolesStructure,
  getRolesWithPermission,
};