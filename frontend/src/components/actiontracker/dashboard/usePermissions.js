import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  createPermissionChecker,
} from './permissionUtils';

/**
 * React Hook: usePermissions
 * 
 * Provides easy permission checking in React components
 * Automatically uses current user and roles from Redux
 * 
 * @returns {Object} - Permission checking methods
 * 
 * @example
 * const permissions = usePermissions();
 * 
 * if (permissions.can('meeting:create')) {
 *   // Render button
 * }
 */
export const usePermissions = () => {
  // Get user and roles from Redux - adjust selectors to match your state structure
  const user = useSelector((state) => state.auth?.user);
  const roles = useSelector((state) => state.roles?.all || state.role?.roles || []);

  // Memoize to avoid recreating on every render
  return useMemo(() => ({
    /**
     * Check if user has a specific permission
     * @param {string} permission - Permission code (e.g., "meeting:create")
     * @returns {boolean}
     */
    can: (permission) => hasPermission(user, permission, roles),

    /**
     * Check if user has ANY of the specified permissions
     * @param {Array<string>} permissions - Array of permission codes
     * @returns {boolean}
     */
    canAny: (permissions) => hasAnyPermission(user, permissions, roles),

    /**
     * Check if user has ALL of the specified permissions
     * @param {Array<string>} permissions - Array of permission codes
     * @returns {boolean}
     */
    canAll: (permissions) => hasAllPermissions(user, permissions, roles),

    /**
     * Get all permissions the user has
     * @returns {Array<string>} - Array of permission codes
     */
    all: () => getUserPermissions(user, roles),

    /**
     * Check if user has a specific permission (alias for 'can')
     * @param {string} permission
     * @returns {boolean}
     */
    has: (permission) => hasPermission(user, permission, roles),

    /**
     * Get raw user and roles data
     */
    user,
    roles,
  }), [user, roles]);
};

/**
 * React Hook: useCanAction
 * 
 * Convenience hook for checking a single permission
 * More convenient when you only need one check
 * 
 * @param {string} permission - Permission to check
 * @returns {boolean}
 * 
 * @example
 * const canCreateMeeting = useCanAction('meeting:create');
 * 
 * return canCreateMeeting ? <Button>Schedule Meeting</Button> : null;
 */
export const useCanAction = (permission) => {
  const permissions = usePermissions();
  return permissions.can(permission);
};

/**
 * React Hook: useHasAnyRole
 * 
 * Check if user has any of the specified roles
 * 
 * @param {Array<string>} rolesCodes - Array of role codes
 * @returns {boolean}
 * 
 * @example
 * const isManager = useHasAnyRole(['manager', 'head', 'admin']);
 */
export const useHasAnyRole = (roleCodes = []) => {
  const user = useSelector((state) => state.auth?.user);

  return useMemo(() => {
    if (!user || !user.roles) return false;
    return user.roles.some((role) => roleCodes.includes(role));
  }, [user, roleCodes]);
};

/**
 * React Hook: useAllUserRoles
 * 
 * Get all roles assigned to the user
 * 
 * @returns {Array<string>} - Array of role codes
 * 
 * @example
 * const userRoles = useAllUserRoles();
 * console.log(userRoles); // ['manager', 'participant']
 */
export const useAllUserRoles = () => {
  const user = useSelector((state) => state.auth?.user);

  return useMemo(() => {
    return user?.roles || [];
  }, [user?.roles]);
};

/**
 * React Hook: useForbidden
 * 
 * Get a boolean indicating if an action is forbidden
 * Useful for showing "not allowed" messages
 * 
 * @param {string} permission - Permission to check
 * @returns {boolean} - True if user does NOT have permission
 * 
 * @example
 * const isForbidden = useForbidden('meeting:delete');
 * 
 * return isForbidden ? <DisabledButton>Delete</DisabledButton> : <Button>Delete</Button>;
 */
export const useForbidden = (permission) => {
  const canDo = useCanAction(permission);
  return !canDo;
};

export default usePermissions;