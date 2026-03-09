export interface JwtPayload {
    sub: string;
    email: string;
    roles: string[];
    iat?: number;
    exp?: number;
}

export interface JwtRefreshPayload extends JwtPayload {
    refreshToken: string;
}

export interface Tokens {
    accessToken: string;
    refreshToken: string;
}

export interface AuthenticatedUser {
    userId: string;
    email: string;
    roles: string[];
}