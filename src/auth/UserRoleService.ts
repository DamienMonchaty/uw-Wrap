/**
 * UserRoleService - Single responsibility: Role and permission management
 * Extracted from AuthenticationMiddleware for better separation of concerns
 */

export interface RoleCheckResult {
    success: boolean;
    hasPermission: boolean;
    userRoles: string[];
    requiredRoles: string[];
    missingRoles?: string[];
}

export interface User {
    userId: number;
    email: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
}

/**
 * User Role Service - Handles role-based access control
 */
export class UserRoleService {
    
    /**
     * Check if user has any of the required roles
     */
    hasAnyRole(user: User, requiredRoles: string[]): RoleCheckResult {
        const userRoles = this.getUserRoles(user);
        
        const hasPermission = requiredRoles.length === 0 || 
                             requiredRoles.some(role => userRoles.includes(role));
        
        const missingRoles = hasPermission ? 
                            [] : 
                            requiredRoles.filter(role => !userRoles.includes(role));

        return {
            success: true,
            hasPermission,
            userRoles,
            requiredRoles,
            missingRoles: hasPermission ? undefined : missingRoles
        };
    }

    /**
     * Check if user has all required roles
     */
    hasAllRoles(user: User, requiredRoles: string[]): RoleCheckResult {
        const userRoles = this.getUserRoles(user);
        
        const hasPermission = requiredRoles.every(role => userRoles.includes(role));
        const missingRoles = requiredRoles.filter(role => !userRoles.includes(role));

        return {
            success: true,
            hasPermission,
            userRoles,
            requiredRoles,
            missingRoles: hasPermission ? undefined : missingRoles
        };
    }

    /**
     * Check if user has specific permission
     */
    hasPermission(user: User, permission: string): boolean {
        const permissions = user.permissions || [];
        return permissions.includes(permission);
    }

    /**
     * Check if user has any of the specified permissions
     */
    hasAnyPermission(user: User, permissions: string[]): boolean {
        const userPermissions = user.permissions || [];
        return permissions.some(permission => userPermissions.includes(permission));
    }

    /**
     * Get all roles for a user (handles both 'role' and 'roles' formats)
     */
    getUserRoles(user: User): string[] {
        const roles: string[] = [];
        
        // Handle single role
        if (user.role) {
            roles.push(user.role);
        }
        
        // Handle multiple roles
        if (user.roles && Array.isArray(user.roles)) {
            roles.push(...user.roles);
        }
        
        // Remove duplicates and normalize
        return [...new Set(roles.map(role => role.toLowerCase()))];
    }

    /**
     * Check if user is admin
     */
    isAdmin(user: User): boolean {
        const roles = this.getUserRoles(user);
        return roles.includes('admin') || roles.includes('administrator');
    }

    /**
     * Check if user is moderator or higher
     */
    isModerator(user: User): boolean {
        const roles = this.getUserRoles(user);
        return roles.includes('admin') || 
               roles.includes('administrator') || 
               roles.includes('moderator');
    }

    /**
     * Get role hierarchy level (higher number = more permissions)
     */
    getRoleLevel(role: string): number {
        const roleHierarchy: Record<string, number> = {
            'user': 1,
            'member': 2,
            'moderator': 5,
            'admin': 10,
            'administrator': 10,
            'superadmin': 15
        };

        return roleHierarchy[role.toLowerCase()] || 0;
    }

    /**
     * Check if user has sufficient role level
     */
    hasMinimumRoleLevel(user: User, minimumLevel: number): boolean {
        const userRoles = this.getUserRoles(user);
        const maxUserLevel = Math.max(...userRoles.map(role => this.getRoleLevel(role)));
        
        return maxUserLevel >= minimumLevel;
    }

    /**
     * Validate role format and existence
     */
    validateRoles(roles: string[]): { valid: boolean; invalidRoles: string[] } {
        const validRoles = ['user', 'member', 'moderator', 'admin', 'administrator', 'superadmin'];
        const invalidRoles = roles.filter(role => !validRoles.includes(role.toLowerCase()));
        
        return {
            valid: invalidRoles.length === 0,
            invalidRoles
        };
    }
}
