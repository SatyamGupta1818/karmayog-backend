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
  ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import {
  LoginResponseDto,
  TokensResponseDto,
  UserResponseDto,
  MessageResponseDto,
  OTPResponseDto,
  RegisterOrganizationResponseDto,
} from './dto/auth-response.dto';
import { OTPDto, RegisterOrganizationDto, SwitchOrganizationDto, VerifyOTPDto } from './dto/auth.dto';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { UserRole } from '../rbac/entities/roles.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Register Organization
  // POST /auth/register
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new organization and its first (owner) user',
    description:
      'Creates the organization and the owner account. ' +
      'After registration, the owner should use POST /auth/request-otp to log in.',
  })
  @ApiResponse({ status: 201, type: RegisterOrganizationResponseDto })
  @ApiResponse({ status: 409, description: 'Email or organization already exists' })
  async registerOrganization(@Body() dto: RegisterOrganizationDto): Promise<RegisterOrganizationResponseDto> {
    return this.authService.registerOrganization(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Request OTP
  // POST /auth/request-otp
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a one-time password (OTP) for login',
    description:
      'Sends a 6-digit OTP to the registered email. ' +
      'OTP expires in 10 minutes. Use POST /auth/verify-otp to complete login.',
  })
  @ApiResponse({ status: 200, type: OTPResponseDto })
  @ApiResponse({ status: 400, description: 'OTP already sent; please wait' })
  @ApiResponse({ status: 401, description: 'Account locked' })
  async requestOTP(@Body() dto: OTPDto): Promise<OTPResponseDto> {
    return this.authService.requestOTP(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Verify OTP  (Login)
  // POST /auth/verify-otp
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP and receive access + refresh tokens',
    description:
      'Completes OTP-based login. Returns a short-lived access token (15m) ' +
      'and a long-lived refresh token (7d). ' +
      'Store the refresh token securely (httpOnly cookie recommended in production).',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOTP(@Body() dto: VerifyOTPDto): Promise<LoginResponseDto> {
    return this.authService.verifyOTP(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Resend OTP
  // POST /auth/resend-otp
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend a fresh OTP (invalidates any previous OTP)',
    description:
      'Use this when the user clicks "Resend OTP". ' +
      'The previous OTP is immediately invalidated.',
  })
  @ApiResponse({ status: 200, type: OTPResponseDto })
  @ApiResponse({ status: 401, description: 'Account locked' })
  async resendOTP(@Body() dto: OTPDto): Promise<OTPResponseDto> {
    return this.authService.resendOTP(dto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROTECTED (Refresh Token): Refresh Tokens
  // POST /auth/refresh
  // ──────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('refresh-token')
  @ApiOperation({
    summary: 'Rotate tokens using a valid refresh token',
    description:
      'Pass the refresh token in the Authorization header as a Bearer token. ' +
      'Returns a new access token and a new refresh token (rotation). ' +
      'The old refresh token is immediately invalidated.',
  })
  @ApiResponse({ status: 200, type: TokensResponseDto })
  @ApiResponse({ status: 403, description: 'Invalid or expired refresh token' })
  async refreshTokens(
    @GetCurrentUser('userId') userId: string,
    @GetCurrentUser('email') email: string,
    @GetCurrentUser('roles') roles: string[],
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<TokensResponseDto> {
    return this.authService.refreshTokens(userId, email, roles, refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Switch SUPER_ADMIN tenant context to another organization',
    description:
      'Updates the active organization for the current SUPER_ADMIN and returns fresh access and refresh tokens containing the new orgId.',
  })
  @ApiResponse({ status: 200, type: TokensResponseDto })
  @ApiResponse({ status: 403, description: 'Only SUPER_ADMIN can switch organizations' })
  @ApiResponse({ status: 404, description: 'Organization not found or inactive' })
  async switchOrganization(
    @GetCurrentUser('userId') userId: string,
    @GetCurrentUser('roles') roles: string[],
    @Body() dto: SwitchOrganizationDto,
  ): Promise<TokensResponseDto> {
    return this.authService.switchOrganization(userId, roles, dto.orgId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROTECTED (Access Token): Logout
  // POST /auth/logout
  // ──────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Logout and invalidate the refresh token',
    description: 'Clears the stored refresh token hash, ending the session.',
  })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  async logout(
    @GetCurrentUser('userId') userId: string,
  ): Promise<MessageResponseDto> {
    return this.authService.logout(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PROTECTED (Access Token): Get Profile
  // GET /auth/me
  // ──────────────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the currently authenticated user profile',
  })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(
    @GetCurrentUser('userId') userId: string,
  ): Promise<Partial<UserResponseDto>> {
    return this.authService.getProfile(userId) as any;
  }
}
