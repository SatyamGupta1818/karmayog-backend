import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

/**
 * Restricts a route to users whose role grants ALL of the given permission keys
 * (e.g. 'tasks:create'). Enforced by PermissionsGuard, which reads the RBAC
 * tables (role → role_permissions → module_permissions → permissions).
 *
 * SUPER_ADMIN bypasses this check. Routes with no @RequirePermission() are
 * unaffected (only authentication is required).
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
