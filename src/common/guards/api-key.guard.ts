import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

        // Key sent but wrong
        if (apiKey !== expectedKey) {
            throw new ForbiddenException('Invalid API key.');
        }

        return true;
    }
}