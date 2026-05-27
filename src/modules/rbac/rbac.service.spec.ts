import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { User } from '../users/entities/user.entity';
import { ModulePermission } from './entities/module-permission.rbac';
import { Modules } from './entities/modules.rbac';
import { Permission } from './entities/permissions.rbac';
import { RolePermission } from './entities/role-permission.rbac';
import { Role } from './entities/roles.entity';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(async () => {
    const repositoryMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: getRepositoryToken(Modules), useValue: repositoryMock },
        { provide: getRepositoryToken(Permission), useValue: repositoryMock },
        { provide: getRepositoryToken(ModulePermission), useValue: repositoryMock },
        { provide: getRepositoryToken(RolePermission), useValue: repositoryMock },
        { provide: getRepositoryToken(Role), useValue: repositoryMock },
        { provide: getRepositoryToken(User), useValue: repositoryMock },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
