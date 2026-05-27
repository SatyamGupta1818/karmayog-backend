// src/modules/rbac/dto/assign-menu-permissions.dto.ts

import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class AssignModulePermissionsDto {
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    permissionIds: string[];
}

export class AssignRolePermissionsDto {
    @IsArray()
    @IsUUID('4', { each: true })
    modulePermissionIds: string[];
}