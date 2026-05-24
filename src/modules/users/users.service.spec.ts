import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { Department } from '../departments/entities/department.entity';
import { Team } from '../departments/entities/team.entity';
import { Role } from '../rbac/entities/roles.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const repositoryMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repositoryMock },
        { provide: getRepositoryToken(Department), useValue: repositoryMock },
        { provide: getRepositoryToken(Team), useValue: repositoryMock },
        { provide: getRepositoryToken(Role), useValue: repositoryMock },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
