import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
    override handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
        if (err) {
            throw err;
        }
        if (!user) {
            throw new UnauthorizedException('Invalid or missing Refresh token');
        }
        return user;
    }
}