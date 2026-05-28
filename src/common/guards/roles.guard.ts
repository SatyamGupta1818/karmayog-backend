import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface UserPayload {
    roles?: string[];
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // No roles required — allow access
        if (!requiredRoles || requiredRoles.length === 0) return true;

        // Explicitly type the request context to access 'user' safely
        const request = context.switchToHttp().getRequest<{ user?: UserPayload }>();
        const user = request.user;

        const hasRole = requiredRoles.some((role) => user?.roles?.includes(role));

        if (!hasRole) {
            throw new ForbiddenException(
                `Access denied. Required roles: ${requiredRoles.join(', ')}`,
            );
        }

        return true;
    }
}