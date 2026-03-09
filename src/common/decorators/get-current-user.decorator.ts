import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser, JwtRefreshPayload } from 'src/modules/auth/interfaces/jwt-payload.interface';

export const GetCurrentUser = createParamDecorator(
    (
        data: keyof (AuthenticatedUser & JwtRefreshPayload) | undefined,
        ctx: ExecutionContext,
    ) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;

        if (!user) return null;

        return data ? user[data] : user;
    },
);