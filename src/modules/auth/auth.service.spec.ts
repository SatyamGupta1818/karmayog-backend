import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmailService } from '../../shared/services/email.service';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../rbac/entities/roles.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const repositoryMock = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repositoryMock },
        { provide: getRepositoryToken(Role), useValue: repositoryMock },
        { provide: getRepositoryToken(Organization), useValue: repositoryMock },
        { provide: DataSource, useValue: {} },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
            getOrThrow: jest.fn(() => 'secret'),
          },
        },
        { provide: EmailService, useValue: {} },
        { provide: RedisService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
