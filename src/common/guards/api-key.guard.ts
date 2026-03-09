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
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];

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