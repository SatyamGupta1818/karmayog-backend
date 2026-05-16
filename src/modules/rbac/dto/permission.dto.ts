import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreatePermissionDto {
    @IsString()
    @MaxLength(80)
    name: string;

    @IsString()
    @MaxLength(80)
    key: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) { }
