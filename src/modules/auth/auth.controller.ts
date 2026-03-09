import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';

// ✅ Import from the files that EXIST — jwt-auth.guard and jwt-refresh.guard
// ❌ NOT from access.guard or refresh.guard (those are deleted)
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';

import { Public } from 'src/common/decorators/public.decorator';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  LoginResponseDto,
  TokensResponseDto,
  UserResponseDto,
  MessageResponseDto,
} from './dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // ── Register ──────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, type: LoginResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(@Body() registerDto: RegisterDto): Promise<LoginResponseDto> {
    return this.authService.register(registerDto);
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and receive tokens' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)  // ✅ JwtAuthGuard from jwt-auth.guard.ts
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async logout(
    @GetCurrentUser('userId') userId: string,
  ): Promise<MessageResponseDto> {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  // ── Refresh Tokens ────────────────────────────────────────────────────────

  @Public()
  @UseGuards(JwtRefreshGuard)  // ✅ JwtRefreshGuard from jwt-refresh.guard.ts
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, type: TokensResponseDto })
  async refreshTokens(
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('email') email: string,
    @GetCurrentUser('roles') roles: string[],
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<TokensResponseDto> {
    return this.authService.refreshTokens(userId, email, roles, refreshToken);
  }

  // ── Get Profile ───────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)  // ✅ JwtAuthGuard from jwt-auth.guard.ts
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get currently authenticated user profile' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getProfile(
    @GetCurrentUser('userId') userId: string,
  ): Promise<Partial<UserResponseDto>> {
    return this.authService.getProfile(userId) as any;
  }
}