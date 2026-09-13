import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';
import { EmailService } from '../../shared/services/email.service';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../rbac/entities/roles.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Role), useValue: {} },
        { provide: getRepositoryToken(Organization), useValue: {} },
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

  it('should reject refresh when stored refresh token hash does not match', async () => {
    const refreshToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        orgId: 'org-123',
      },
      'secret',
      { expiresIn: '1h' },
    );

    userRepository.findOne.mockResolvedValue({
      id: 'user-123',
      hashedRefreshToken: await bcrypt.hash('different-token', 10),
    });

    await expect(
      service.refreshTokens({ headers: { authorization: `Bearer ${refreshToken}` } }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should rotate refresh token only when stored refresh token matches the user session', async () => {
    const refreshToken = jwt.sign(
      {
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['USER'],
        orgId: 'org-123',
      },
      'secret',
      { expiresIn: '1h' },
    );

    userRepository.findOne.mockResolvedValue({
      id: 'user-123',
      hashedRefreshToken: await bcrypt.hash(refreshToken, 10),
    });
    userRepository.update.mockResolvedValue({ affected: 1 });

    const response = await service.refreshTokens({ headers: { authorization: `Bearer ${refreshToken}` } });

    expect(response).toHaveProperty('accessToken');
    expect(response).toHaveProperty('refreshToken');
    expect(userRepository.update).toHaveBeenCalledWith('user-123', expect.objectContaining({
      hashedRefreshToken: expect.any(String),
    }));
  });
});
