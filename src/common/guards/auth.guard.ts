import {
    Injectable,
    CanActivate,
    ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_API_KEY } from '../decorators/api-key.decorator';

@Injectable()
export class CompositeAuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwtAuthGuard: JwtAuthGuard,
        private readonly apiKeyGuard: ApiKeyGuard,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check BOTH handler (@Get, @Post) AND class (@Controller) level for metadata
        // Previously only checking getHandler() — class-level decorators were ignored
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;

        const requireApiKey = this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (requireApiKey) {
            // Route decorated with @RequireApiKey() — validate x-api-key header only
            return this.apiKeyGuard.canActivate(context);
        }

        // Default: JWT bearer token required
        return this.jwtAuthGuard.canActivate(context) as Promise<boolean>;
    }
}