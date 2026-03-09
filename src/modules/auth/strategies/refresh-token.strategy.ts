import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload, JwtRefreshPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
            passReqToCallback: true, // Needed to extract raw refresh token
        });
    }

    validate(req: Request, payload: JwtPayload): JwtRefreshPayload {
        // Extract the raw token from the Authorization header
        const authHeader = req.get('Authorization');
        if (!authHeader) {
            throw new UnauthorizedException('No authorization header');
        }

        const refreshToken = authHeader.replace('Bearer', '').trim();

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh token is malformed');
        }

        return {
            ...payload,
            refreshToken,
        };
    }
}