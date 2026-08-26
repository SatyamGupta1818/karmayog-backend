import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        // Explicitly type headers to avoid 'any' propagation
        const request = context.switchToHttp().getRequest<{
            headers: Record<string, string | string[] | undefined>;
        }>();
        
        const apiKeyHeader = request.headers['x-api-key'];
        const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

        // No key sent at all
        if (!apiKey) {
            throw new UnauthorizedException('API key is required. Provide it in the x-api-key header.');
        }

        const expectedKey = this.configService.get<string>('API_KEY');

        // Constant-time comparison to avoid leaking the key via timing.
        if (!expectedKey || !this.safeEqual(apiKey, expectedKey)) {
            throw new ForbiddenException('Invalid API key.');
        }

        return true;
    }

    private safeEqual(a: string, b: string): boolean {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        // timingSafeEqual throws on length mismatch — guard first (length is not secret).
        if (bufA.length !== bufB.length) return false;
        return timingSafeEqual(bufA, bufB);
    }
}