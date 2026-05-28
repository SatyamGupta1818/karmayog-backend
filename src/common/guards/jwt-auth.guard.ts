import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    override canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        return super.canActivate(context);
    }

    override handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
        if (err) {
            throw err;
        }
        if (!user) {
            throw new UnauthorizedException('Invalid or missing JWT token');
        }
        return user;
    }
}