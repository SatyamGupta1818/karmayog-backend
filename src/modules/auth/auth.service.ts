import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { JwtPayload, Tokens } from './interfaces/jwt-payload.interface';
import { User } from '../users/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import {
  LoginResponseDto,
  MessageResponseDto,
  OTPResponseDto,
  RegisterOrganizationResponseDto,
  TokensResponseDto,
} from './dto/auth-response.dto';
import { OTPDto, RegisterOrganizationDto, VerifyOTPDto } from './dto/auth.dto';

import { EmailService } from '../../shared/services/email.service';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Role, UserRole } from '../rbac/entities/roles.entity';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const OTP_EXPIRY_SECONDS = 600; // 10 minutes

// Redis key helpers
const otpKey = (email: string) => `otp:${email}`;
const otpAttemptsKey = (email: string) => `otp_attempts:${email}`;
const MAX_OTP_VERIFY_ATTEMPTS = 5;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(Organization)
    private readonly orgRepository: Repository<Organization>,

    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService,
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '50m');
    this.refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REQUEST OTP
  // POST /auth/request-otp
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generates and emails a 6-digit OTP.
   * Only sends if the email belongs to an active account.
   */
  async requestOTP(dto: OTPDto): Promise<OTPResponseDto> {
    const { email } = dto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lockedUntil'],
    });

    if (!user || !user.isActive) {
      this.logger.warn(`OTP requested for unknown/inactive email: ${email}`);
      return { message: 'If this email is registered, you will receive an OTP shortly.' };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account is temporarily locked. Try again in ${remaining} minute(s).`,
      );
    }

    const existingOtp = await this.safeRedisGet(otpKey(email));
    if (existingOtp) {
      throw new BadRequestException(
        'An OTP was already sent. Please wait before requesting a new one.',
      );
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.redisService.set(otpKey(email), hashedOtp, OTP_EXPIRY_SECONDS);
    await this.redisService.del(otpAttemptsKey(email));

    await this.emailService.sendOtpEmail(email, otp, `${user.firstName} ${user.lastName}`);

    this.logger.log(`OTP sent to ${email}`);

    return { message: 'If this email is registered, you will receive an OTP shortly.' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VERIFY OTP  (Login)
  // POST /auth/verify-otp
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifies OTP and issues access + refresh tokens.
   * This is the primary login endpoint for OTP-based auth.
   */
  async verifyOTP(dto: VerifyOTPDto): Promise<LoginResponseDto> {
    const { email, otp } = dto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive. Contact support.');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account is locked. Try again in ${remaining} minute(s).`,
      );
    }

    const attemptsRaw = await this.safeRedisGet(otpAttemptsKey(email));
    const attempts = attemptsRaw ? parseInt(attemptsRaw, 10) : 0;

    if (attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      // Lock the account and invalidate the OTP
      await this.lockAccount(user);
      await this.redisService.del(otpKey(email));
      await this.redisService.del(otpAttemptsKey(email));
      throw new UnauthorizedException(
        'Too many failed attempts. Account locked for 15 minutes.',
      );
    }

    // ── Fetch and validate stored OTP ────────────────────────────────────────
    const storedHash = await this.safeRedisGet(otpKey(email));

    if (!storedHash) {
      throw new UnauthorizedException(
        'OTP has expired or was not requested. Please request a new one.',
      );
    }

    const isValid = await bcrypt.compare(otp, storedHash);

    if (!isValid) {
      // Increment failure counter (TTL same as OTP window)
      await this.redisService.set(
        otpAttemptsKey(email),
        String(attempts + 1),
        OTP_EXPIRY_SECONDS,
      );
      this.logger.warn(`Invalid OTP attempt ${attempts + 1} for ${email}`);
      throw new UnauthorizedException('Invalid OTP. Please try again.');
    }

    // ── Success: clean up Redis, reset DB counters ────────────────────────────
    await Promise.all([
      this.redisService.del(otpKey(email)),
      this.redisService.del(otpAttemptsKey(email)),
    ]);

    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    });

    // ── Issue tokens ──────────────────────────────────────────────────────────
    const roles: string[] = user.role ? [user.role.name] : [];
    const tokens = await this.generateTokens(user.id, user.email, roles);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User ${email} logged in successfully`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: user.toSafeObject() as any,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REGISTER ORGANIZATION + OWNER
  // POST /auth/register
  // ──────────────────────────────────────────────────────────────────────────

  async registerOrganization(dto: RegisterOrganizationDto): Promise<RegisterOrganizationResponseDto> {
    const {
      workEmail,
      firstName,
      lastName,
      mobileNo,
      designation,
      organizationName,
      organizationType,
      organizationSize,
      orgEmail,
    } = dto;

    const [emailTaken, orgEmailTaken] = await Promise.all([
      this.userRepository.existsBy({ email: workEmail }),
      this.orgRepository.existsBy({ orgEmail }),
    ]);

    if (emailTaken) {
      throw new ConflictException('A user with this email already exists.');
    }
    if (orgEmailTaken) {
      throw new ConflictException('An organization with this email already exists.');
    }

    // ── Transactional create ──────────────────────────────────────────────────
    return this.dataSource.transaction(async (manager) => {
      const ownerRole = await manager.findOneBy(Role, { name: UserRole.OWNER });

      if (!ownerRole) {
        throw new NotFoundException(
          'Required role "OWNER" not found. Please seed the roles table.',
        );
      }

      const organization = manager.create(Organization, {
        organizationName,
        organizationType,
        organizationSize,
        orgEmail,
      });
      const savedOrg = await manager.save(organization);

      const user = manager.create(User, {
        firstName,
        lastName,
        email: workEmail,
        mobileNo,
        designation,
        organization: savedOrg,
        role: ownerRole,
      });
      const savedUser = await manager.save(user);

      this.logger.log(`Organization "${organizationName}" registered by ${workEmail}`);

      return {
        message: 'Organization registered successfully. Use your work email to log in.',
        data: {
          organization: savedOrg as any,
          user: savedUser.toSafeObject() as any,
        },
      } as RegisterOrganizationResponseDto;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REFRESH TOKENS
  // POST /auth/refresh  (protected by JwtRefreshGuard)
  // ──────────────────────────────────────────────────────────────────────────

  async refreshTokens(userId: string, email: string, roles: string[], incomingRefreshToken: string): Promise<TokensResponseDto> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.hashedRefreshToken')
      .where('user.id = :id AND user.isActive = :isActive', {
        id: userId,
        isActive: true,
      })
      .getOne();

    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Access denied. Please log in again.');
    }

    const tokenMatches = await bcrypt.compare(incomingRefreshToken, user.hashedRefreshToken,
    );

    if (!tokenMatches) {
      await this.userRepository.update(userId, { hashedRefreshToken: null });
      this.logger.warn(`Refresh token reuse detected for user: ${userId}`);
      throw new ForbiddenException(
        'Refresh token already used or invalid. Please log in again.',
      );
    }

    const tokens = await this.generateTokens(userId, email, roles);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    this.logger.log(`Tokens refreshed for user: ${userId}`);
    return tokens;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // LOGOUT
  // POST /auth/logout  (protected by JwtAuthGuard)
  // ──────────────────────────────────────────────────────────────────────────

  async logout(userId: string): Promise<MessageResponseDto> {
    const result = await this.userRepository.update(
      { id: userId },
      { hashedRefreshToken: null },
    );

    if (result.affected === 0) {
      this.logger.warn(`Logout called for ${userId} with no active session`);
    } else {
      this.logger.log(`User ${userId} logged out`);
    }

    return { message: 'Logged out successfully' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET PROFILE
  // GET /auth/me  (protected by JwtAuthGuard)
  // ──────────────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organization', 'role'],
    });

    if (!user) throw new NotFoundException('User not found');

    return user.toSafeObject();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RESEND OTP
  // POST /auth/resend-otp  (same as requestOTP but explicit endpoint)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Explicitly deletes any existing OTP and issues a fresh one.
   * Useful for "Resend OTP" buttons on the frontend.
   */
  async resendOTP(dto: OTPDto): Promise<OTPResponseDto> {
    const { email } = dto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lockedUntil'],
    });

    if (!user || !user.isActive) {
      return { message: 'If this email is registered, you will receive an OTP shortly.' };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Account is locked. Try again in ${remaining} minute(s).`,
      );
    }

    // Force-delete any existing OTP and attempt counters
    await Promise.all([
      this.redisService.del(otpKey(email)),
      this.redisService.del(otpAttemptsKey(email)),
    ]);

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    await this.redisService.set(otpKey(email), hashedOtp, OTP_EXPIRY_SECONDS);

    await this.emailService.sendOtpEmail(
      email,
      otp,
      `${user.firstName} ${user.lastName}`,
    );

    this.logger.log(`OTP resent to ${email}`);

    return { message: 'A new OTP has been sent. It expires in 10 minutes.' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private async generateTokens(userId: string, email: string, roles: string[],): Promise<Tokens> {
    const payload: JwtPayload = { sub: userId, email, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn,
      } as any),
      this.jwtService.signAsync(payload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn,
      } as any),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { hashedRefreshToken: hashed });
  }

  private async lockAccount(user: User): Promise<void> {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
    await this.userRepository.update(user.id, {
      failedLoginAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil,
    });
    this.logger.warn(`Account locked for ${LOCK_DURATION_MINUTES}m: ${user.email}`);
  }

  /**
   * Safely calls redisService.get() — returns null instead of throwing
   * if the key doesn't exist.
   */
  private async safeRedisGet(key: string): Promise<string | null> {
    try {
      return await this.redisService.get(key);
    } catch {
      return null;
    }
  }
}