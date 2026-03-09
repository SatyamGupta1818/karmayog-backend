import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entities/user.entity';


// ✅ Import from files that EXIST — jwt-auth.guard and jwt-refresh.guard
// ❌ NOT from access.guard or refresh.guard (those are deleted)
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';
import { JwtAccessStrategy } from './strategies/access-tokern.strategy';
import { JwtRefreshStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // secrets provided per-call in auth.service.ts
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,     // ✅ registered so it can be injected via @UseGuards
    JwtRefreshGuard,  // ✅ registered so it can be injected via @UseGuards
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtRefreshGuard,
    TypeOrmModule,
  ],
})
export class AuthModule { }