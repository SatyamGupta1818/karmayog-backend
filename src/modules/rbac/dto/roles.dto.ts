// src/modules/rbac/dto/role.dto.ts

import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { UserRole } from '../entities/roles.entity';
import { Type } from 'class-transformer';

export class CreateRoleDto {
    @IsEnum(UserRole)
    name: UserRole;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateRoleDto {
    @IsOptional()
    @IsEnum(UserRole)
    name?: UserRole;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}


export class RoleModulePermissionDto {
    @IsUUID()
    moduleId: string;

    @IsArray()
    @ArrayUnique()
    @IsUUID('4', { each: true })
    permissionIds: string[];
}

export class UpdateRolePermissionsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => RoleModulePermissionDto)
    modules: RoleModulePermissionDto[];
}