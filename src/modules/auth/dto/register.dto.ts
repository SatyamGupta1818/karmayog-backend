import {
    IsEmail,
    IsString,
    MinLength,
    MaxLength,
    Matches,
    IsOptional,
    IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class RegisterDto {
    @ApiProperty({ example: 'John', description: 'First name of the user' })
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    firstName: string;

    @ApiProperty({ example: 'Doe', description: 'Last name of the user' })
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    lastName: string;

    @ApiProperty({ example: 'user@example.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @ApiProperty({
        example: 'StrongP@ss123',
        description:
            'Password must contain uppercase, lowercase, number, and special character',
        minLength: 8,
    })
    @IsString()
    @MinLength(8)
    @MaxLength(64)
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
    })
    password: string;

    @ApiPropertyOptional({ example: ['user'], description: 'Roles to assign' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    roles?: string[];
}