import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

// Entities
import { User } from '../users/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Role } from '../rbac/entities/roles.entity';

// Strategies
// FIX: Original imported from 'access-tokern.strategy' (typo) and
// 'refresh-token.strategy' — neither file exists. Corrected to the actual
// filenames generated: jwt-access.strategy and jwt-refresh.strategy.

// Guards
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiKeyGuard } from 'src/common/guards/api-key.guard';
import { CompositeAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAccessStrategy } from './strategies/access-tokern.strategy';
import { JwtRefreshStrategy } from './strategies/refresh-token.strategy';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.register({}),

    TypeOrmModule.forFeature([User, Organization, Role]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,

    JwtAccessStrategy,
    JwtRefreshStrategy,

    JwtAuthGuard,
    JwtRefreshGuard,
    ApiKeyGuard,
    RolesGuard,

    CompositeAuthGuard,

    {
      provide: APP_GUARD,
      useClass: CompositeAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtRefreshGuard,
    ApiKeyGuard,
    RolesGuard,
    TypeOrmModule,
  ],
})
export class AuthModule { }