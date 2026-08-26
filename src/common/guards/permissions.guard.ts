import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Role, UserRole } from '../../modules/rbac/entities/roles.entity';

interface UserPayload {
  roles?: string[];
}

/**
 * Enforces fine-grained permissions declared with @RequirePermission().
 * Resolves the permission keys granted to the user's role(s) via the RBAC
 * tables and caches that set in Redis (roles rarely change).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly CACHE_TTL = 300; // seconds

  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions declared on this route — nothing to enforce here.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: UserPayload }>();
    const roles = request.user?.roles ?? [];

    if (roles.length === 0) {
      throw new ForbiddenException('Access denied. No role assigned.');
    }

    // SUPER_ADMIN bypasses fine-grained checks.
    if (roles.includes(UserRole.SUPER_ADMIN)) return true;

    const granted = await this.getPermissionsForRoles(roles);
    const hasAll = required.every((perm) => granted.has(perm));

    if (!hasAll) {
      throw new ForbiddenException(
        `Access denied. Missing permission(s): ${required
          .filter((p) => !granted.has(p))
          .join(', ')}`,
      );
    }

    return true;
  }

  private async getPermissionsForRoles(roles: string[]): Promise<Set<string>> {
    const cacheKey = `perm:roles:${[...roles].sort().join(',')}`;

    const cached = await this.redisService.get<string[]>(cacheKey);
    if (cached) return new Set(cached);

    const rows = await this.dataSource
      .getRepository(Role)
      .createQueryBuilder('r')
      .innerJoin('role_permissions', 'rp', 'rp.role_id = r.id')
      .innerJoin('module_permissions', 'mp', 'mp.id = rp.menu_permission_id')
      .innerJoin('permissions', 'p', 'p.id = mp.permission_id')
      .where('r.name IN (:...names)', { names: roles })
      .andWhere('p.is_active = true')
      .andWhere('p.is_deleted = false')
      .select('p.key', 'key')
      .distinct(true)
      .getRawMany<{ key: string }>();

    const keys = rows.map((row) => row.key);
    await this.redisService.set(cacheKey, keys, this.CACHE_TTL);
    return new Set(keys);
  }
}
