import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser, JwtRefreshPayload } from '../../modules/auth/interfaces/jwt-payload.interface';

type UserPayload = AuthenticatedUser & JwtRefreshPayload;

export const GetCurrentUser = createParamDecorator((data: keyof UserPayload | undefined, ctx: ExecutionContext,) => {
    const request = ctx.switchToHttp().getRequest<{ user?: UserPayload }>();
    const user = request.user;

    if (!user) {
        return null;
    }

    return data ? user[data] : user;
},
);