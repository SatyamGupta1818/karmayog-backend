import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    Matches,
    IsOptional,
    IsArray,
} from 'class-validator';

export class TokensResponseDto {
    @ApiProperty({ description: 'JWT access token (short-lived: 15 minutes)' })
    accessToken: string;

    @ApiProperty({ description: 'JWT refresh token (long-lived: 7 days)' })
    refreshToken: string;
}

export class UserResponseDto {
    @ApiProperty({ example: 'uuid-here' })
    @Expose()
    id: string;

    @ApiProperty({ example: 'John' })
    @Expose()
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    @Expose()
    lastName: string;

    @ApiProperty({ example: 'user@example.com' })
    @Expose()
    email: string;

    @ApiProperty({ example: ['user'] })
    @Expose()
    roles: string[];

    @ApiProperty()
    @Expose()
    isActive: boolean;

    @ApiProperty()
    @Expose()
    createdAt: Date;

    @Exclude()
    password: string;

    @Exclude()
    hashedRefreshToken: string;
}

export class LoginResponseDto {
    @ApiProperty()
    user: UserResponseDto;

    @ApiProperty()
    tokens: TokensResponseDto;
}

export class MessageResponseDto {
    @ApiProperty({ example: 'Operation completed successfully' })
    message: string;
}

export class OTPResponseDto {
    @ApiProperty({ example: 'Operation completed successfully' })
    message!: string;
}

