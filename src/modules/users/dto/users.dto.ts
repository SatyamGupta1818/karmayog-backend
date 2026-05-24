import {
    IsEmail,
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    Matches,
    IsOptional,
    IsArray,
    IsUUID,
    IsBoolean,
    IsIn,
    IsInt,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class CreateUserDto {
    @ApiProperty({ example: 'John' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    @Transform(({ value }) => value?.trim())
    lastName: string;

    @ApiProperty({ example: 'hello@gmail.com' })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @Transform(({ value }) => value?.toLowerCase().trim())
    email: string;

    @ApiProperty({ example: 'StrongP@ss123', minLength: 6 })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    @MaxLength(64, { message: 'Password must not exceed 64 characters' })
    @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message:
            'Password must contain uppercase, lowercase, and a number or special character',
    })
    password: string;

    @ApiPropertyOptional({ example: 'uuid-of-role' })
    @IsOptional()
    @IsUUID()
    roleId?: string;

    @ApiPropertyOptional({ example: 'uuid-of-department' })
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @ApiPropertyOptional({ example: ['uuid-of-team'] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    teamIds?: string[];
    
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UserListQueryDto {
    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @ApiPropertyOptional({ example: 'John' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 'uuid-of-department' })
    @IsOptional()
    @IsUUID()
    departmentId?: string;

    @ApiPropertyOptional({ example: 'uuid-of-team' })
    @IsOptional()
    @IsUUID()
    teamId?: string;
    
    @ApiPropertyOptional({ example: 'uuid-of-role' })
    @IsOptional()
    @IsUUID()
    roleId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ example: 'createdAt' })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
