import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/permission.dto';
import { AssignModulePermissionsDto } from './dto/assignModulePermission.dto';
import {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
} from './dto/roles.dto';

import { Modules } from './entities/modules.rbac';
import { Permission } from './entities/permissions.rbac';
import { ModulePermission } from './entities/module-permission.rbac';
import { RolePermission } from './entities/role-permission.rbac';
import { Role } from './entities/roles.entity';
import { User } from '../users/entities/user.entity';
import { RedisService } from 'src/shared/cache/redis/redis.service';
import { IsUUID } from 'class-validator';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private readonly cacheTtl = 300;

  constructor(
    @InjectRepository(Modules)
    private readonly moduleRepo: Repository<Modules>,

    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,

    @InjectRepository(ModulePermission)
    private readonly modulePermissionRepo: Repository<ModulePermission>,

    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly redisService: RedisService,
  ) { }

  private async getCache<T>(key: string): Promise<T | null> {
    return this.redisService.get<T>(key);
  }

  private async setCache<T>(key: string, value: T): Promise<void> {
    await this.redisService.set(key, value, this.cacheTtl);
  }

  private async clearRbacCache(): Promise<void> {
    await this.redisService.delByPattern('rbac:*');
  }

  async createModule(dto: CreateModuleDto) {
    const exists = await this.moduleRepo.findOne({ where: { key: dto.key } });

    if (exists) {
      throw new ConflictException('Module key already exists');
    }

    const module = this.moduleRepo.create(dto);
    const saved = await this.moduleRepo.save(module);

    await this.clearRbacCache();

    return saved;
  }

  async getModules() {
    const cacheKey = 'rbac:modules:list';
    const cached = await this.getCache<Modules[]>(cacheKey);

    if (cached) return cached;

    const modules = await this.moduleRepo.find({
      where: { isActive: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    await this.setCache(cacheKey, modules);

    return modules;
  }

  async getModuleTree() {
    const cacheKey = 'rbac:modules:tree';
    const cached = await this.getCache<any[]>(cacheKey);

    if (cached) return cached;

    const modules = await this.moduleRepo.find({
      where: { isActive: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    const map = new Map<string, any>();

    modules.forEach((module) => {
      map.set(module.id, {
        ...module,
        children: [],
      });
    });

    const tree: any = [];

    map.forEach((module) => {
      if (module.parentId && map.has(module.parentId)) {
        map.get(module.parentId).children.push(module);
      } else {
        tree.push(module);
      }
    });

    await this.setCache(cacheKey, tree);

    return tree;
  }

  async getModuleById(moduleId: string) {
    const cacheKey = `rbac:modules:${moduleId}`;
    const cached = await this.getCache<Modules>(cacheKey);

    if (cached) return cached;

    const module = await this.moduleRepo.findOne({
      where: { id: moduleId, isActive: true },
    });

    if (!module) {
      throw new NotFoundException('Module not found');
    }

    await this.setCache(cacheKey, module);

    return module;
  }

  async updateModule(moduleId: string, dto: UpdateModuleDto) {
    const module = await this.getModuleById(moduleId);

    if (dto.key && dto.key !== module.key) {
      const exists = await this.moduleRepo.findOne({
        where: { key: dto.key },
      });

      if (exists) {
        throw new ConflictException('Module key already exists');
      }
    }

    Object.assign(module, dto);

    const saved = await this.moduleRepo.save(module);

    await this.clearRbacCache();

    return saved;
  }

  async deleteModule(moduleId: string) {
    const module = await this.getModuleById(moduleId);

    await this.moduleRepo.update(module.id, { isDeleted: true, isActive: false });
    await this.clearRbacCache();

    return {
      message: 'Module deleted successfully',
    };
  }

  async createPermission(dto: CreatePermissionDto) {
    const exists = await this.permissionRepo.findOne({
      where: { key: dto.key },
    });

    if (exists) {
      throw new ConflictException('Permission key already exists');
    }

    const permission = this.permissionRepo.create(dto);
    const saved = await this.permissionRepo.save(permission);

    await this.clearRbacCache();

    return saved;
  }

  async getPermissions() {
    const cacheKey = 'rbac:permissions:list';
    const cached = await this.getCache<Permission[]>(cacheKey);

    if (cached) return cached;

    const permissions = await this.permissionRepo.find({
      where: { isActive: true },
      order: {
        createdAt: 'ASC',
      },
    });

    await this.setCache(cacheKey, permissions);

    return permissions;
  }

  async getPermissionById(permissionId: string) {
    const permission = await this.permissionRepo.findOne({
      where: { id: permissionId, isActive: true },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async updatePermission(permissionId: string, dto: UpdatePermissionDto) {
    const permission = await this.getPermissionById(permissionId);

    if (dto.key && dto.key !== permission.key) {
      const exists = await this.permissionRepo.findOne({
        where: { key: dto.key },
      });

      if (exists) {
        throw new ConflictException('Permission key already exists');
      }
    }

    Object.assign(permission, dto);

    const saved = await this.permissionRepo.save(permission);

    await this.clearRbacCache();

    return saved;
  }

  async deletePermission(permissionId: string) {
    const permission = await this.getPermissionById(permissionId);

    await this.permissionRepo.update(permission.id, { isActive: false, isDeleted: true });
    await this.clearRbacCache();

    return {
      message: 'Permission deleted successfully',
    };
  }

  async getModulePermissions(moduleId: string) {
    await this.getModuleById(moduleId);

    return this.modulePermissionRepo.find({
      where: { moduleId },
      relations: {
        permission: true,
        module: true,
      },
    });
  }

  async assignModulePermissions(
    moduleId: string,
    dto: AssignModulePermissionsDto,
  ) {
    await this.getModuleById(moduleId);

    const permissions = await this.permissionRepo.find({
      where: {
        id: In(dto.permissionIds),
        isActive: true,
      },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    await this.modulePermissionRepo.delete({ moduleId });

    const modulePermissions = permissions.map((permission) =>
      this.modulePermissionRepo.create({
        moduleId,
        permissionId: permission.id,
      }),
    );

    const saved = await this.modulePermissionRepo.save(modulePermissions);

    await this.clearRbacCache();

    return saved;
  }

  async createRole(dto: CreateRoleDto) {
    const exists = await this.roleRepo.findOne({
      where: { name: dto.name },
    });

    if (exists) {
      throw new ConflictException('Role already exists');
    }

    const role = this.roleRepo.create(dto);
    const saved = await this.roleRepo.save(role);

    await this.clearRbacCache();

    return saved;
  }

  async getRoles() {
    const cacheKey = 'rbac:roles:list';
    const cached = await this.getCache<Role[]>(cacheKey);

    if (cached) return cached;

    const roles = await this.roleRepo.find({
      order: {
        createdAt: 'ASC',
      },
    });

    await this.setCache(cacheKey, roles);

    return roles;
  }

  async getRoleById(roleId: string) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async updateRole(roleId: string, dto: UpdateRoleDto) {
    const role = await this.getRoleById(roleId);

    if (dto.name && dto.name !== role.name) {
      const exists = await this.roleRepo.findOne({
        where: { name: dto.name },
      });

      if (exists) {
        throw new ConflictException('Role already exists');
      }
    }

    Object.assign(role, dto);

    const saved = await this.roleRepo.save(role);

    await this.clearRbacCache();

    return saved;
  }

  async deleteRole(roleId: string) {
    const role = await this.getRoleById(roleId);

    await this.roleRepo.update(role.id, { isActive: false });
    await this.clearRbacCache();

    return {
      message: 'Role deleted successfully',
    };
  }

  async getRolePermissions(roleId: string) {
    await this.getRoleById(roleId);

    return this.rolePermissionRepo.find({
      where: { roleId },
      relations: {
        modulePermission: {
          module: true,
          permission: true,
        },
      },
    });
  }

  async getRoleModulesWithPermissions(roleId: string) {
    await this.getRoleById(roleId);

    const modules = await this.moduleRepo.find({
      where: { isActive: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
      },
    });

    const modulePermissions = await this.modulePermissionRepo.find({
      relations: {
        module: true,
        permission: true,
      },
    });

    const rolePermissions = await this.rolePermissionRepo.find({
      where: { roleId },
    });

    const allowedModulePermissionIds = new Set(
      rolePermissions.map((rp) => rp.modulePermissionId),
    );

    return modules.map((module) => {
      const permissions = modulePermissions
        .filter((mp) => mp.moduleId === module.id)
        .map((mp) => ({
          modulePermissionId: mp.id,
          permissionId: mp.permissionId,
          name: mp.permission.name,
          key: mp.permission.key,
          allowed: allowedModulePermissionIds.has(mp.id),
        }));

      return {
        ...module,
        permissions,
      };
    });
  }

  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ) {
    await this.getRoleById(roleId);

    const permissionIds = dto.modules.flatMap((module) => module.permissionIds);
    const moduleIds = dto.modules.map((module) => module.moduleId);

    const modulePermissions = await this.modulePermissionRepo.find({
      where: {
        moduleId: In(moduleIds),
        permissionId: In(permissionIds),
      },
    });

    const requestedPairs = new Set(
      dto.modules.flatMap((module) =>
        module.permissionIds.map(
          (permissionId) => `${module.moduleId}:${permissionId}`,
        ),
      ),
    );

    const validPairs = new Set(
      modulePermissions.map((mp) => `${mp.moduleId}:${mp.permissionId}`),
    );

    for (const pair of requestedPairs) {
      if (!validPairs.has(pair)) {
        throw new BadRequestException(
          'One or more permissions are not assigned to selected modules',
        );
      }
    }

    await this.rolePermissionRepo.delete({ roleId });

    const rolePermissions = modulePermissions.map((modulePermission) =>
      this.rolePermissionRepo.create({
        roleId,
        modulePermissionId: modulePermission.id,
      }),
    );

    const saved = await this.rolePermissionRepo.save(rolePermissions);

    await this.clearRbacCache();

    return saved;
  }

  async getMyPermissions(userId: string) {
    const cacheKey = `rbac:user:${userId}:permissions`;
    const cached = await this.getCache<any>(cacheKey);

    if (cached) return cached;

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.role) {
      return {
        role: null,
        modules: [],
      };
    }

    const modules = await this.getRoleModulesWithPermissions(user.role.id);

    const result = {
      role: user.role,
      modules: modules
        .map((module) => ({
          id: module.id,
          name: module.name,
          key: module.key,
          path: module.path,
          icon: module.icon,
          parentId: module.parentId,
          sortOrder: module.sortOrder,
          permissions: module.permissions
            .filter((permission) => permission.allowed)
            .map((permission) => ({
              id: permission.permissionId,
              name: permission.name,
              key: permission.key,
            })),
        }))
        .filter((module) => module.permissions.length > 0),
    };

    await this.setCache(cacheKey, result);

    return result;
  }
}