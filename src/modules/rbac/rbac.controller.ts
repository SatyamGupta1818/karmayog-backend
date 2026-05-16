import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';

import { RbacService } from './rbac.service';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';
import { AssignModulePermissionsDto } from './dto/assignModulePermission.dto';
import { CreateRoleDto, UpdateRoleDto, UpdateRolePermissionsDto } from './dto/roles.dto';

@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) { }

  // ---------------- Modules ----------------

  @Post('modules')
  createModule(@Body() dto: CreateModuleDto) {
    return this.rbacService.createModule(dto);
  }

  @Get('modules')
  getModules() {
    return this.rbacService.getModules();
  }

  @Get('modules/tree')
  getModuleTree() {
    return this.rbacService.getModuleTree();
  }

  @Get('modules/:moduleId')
  getModuleById(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.rbacService.getModuleById(moduleId);
  }

  @Patch('modules/:moduleId')
  updateModule(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.rbacService.updateModule(moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteModule(@Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.rbacService.deleteModule(moduleId);
  }

  // ---------------- Permissions ----------------

  @Post('permissions')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.rbacService.createPermission(dto);
  }

  @Get('permissions')
  getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Get('permissions/:permissionId')
  getPermissionById(
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rbacService.getPermissionById(permissionId);
  }

  @Patch('permissions/:permissionId')
  updatePermission(
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.rbacService.updatePermission(permissionId, dto);
  }

  @Delete('permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePermission(
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rbacService.deletePermission(permissionId);
  }

  // ---------------- Module Permissions ----------------

  @Get('modules/:moduleId/permissions')
  getModulePermissions(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
  ) {
    return this.rbacService.getModulePermissions(moduleId);
  }

  @Put('modules/:moduleId/permissions')
  assignModulePermissions(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: AssignModulePermissionsDto,
  ) {
    return this.rbacService.assignModulePermissions(moduleId, dto);
  }

  // ---------------- Roles ----------------

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbacService.createRole(dto);
  }

  @Get('roles')
  getRoles() {
    return this.rbacService.getRoles();
  }

  @Get('roles/:roleId')
  getRoleById(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.rbacService.getRoleById(roleId);
  }

  @Patch('roles/:roleId')
  updateRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbacService.updateRole(roleId, dto);
  }

  @Delete('roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRole(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.rbacService.deleteRole(roleId);
  }

  // ---------------- Role Permissions ----------------

  @Get('roles/:roleId/permissions')
  getRolePermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.rbacService.getRolePermissions(roleId);
  }

  @Get('roles/:roleId/modules-permissions')
  getRoleModulesWithPermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.rbacService.getRoleModulesWithPermissions(roleId);
  }

  @Put('roles/:roleId/permissions')
  updateRolePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbacService.updateRolePermissions(roleId, dto);
  }

  // ---------------- Logged-in User Permissions ----------------

  @Get('me/permissions')
  getMyPermissions(@Req() req: any) {
    return this.rbacService.getMyPermissions(req.user.id);
  }
}