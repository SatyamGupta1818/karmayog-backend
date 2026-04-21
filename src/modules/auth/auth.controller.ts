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

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from 'src/common/guards/jwt-refresh.guard';

import { Public } from 'src/common/decorators/public.decorator';
import { GetCurrentUser } from 'src/common/decorators/get-current-user.decorator';
import {
  LoginResponseDto,
  TokensResponseDto,
  UserResponseDto,
  MessageResponseDto,
  OTPResponseDto,
} from './dto/auth-response.dto';
import { OTPDto, RegisterOrganizationDto } from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }


  /** ----------------------------------  Request OTP ------------------------------------------ */

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for Authentication' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async requestOTP(@Body() otpDto: OTPDto): Promise<OTPResponseDto> {
    return this.authService.requestOTP(otpDto)
  }



  /** ------------------------------ Register Organization ------------------------------------ */
  @Public()
  @Post("register")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for Authentication' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async registerOrganization(@Body() registerOrganizationDto: RegisterOrganizationDto) {
    return this.authService.registerOrganization(registerOrganizationDto)
  }

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