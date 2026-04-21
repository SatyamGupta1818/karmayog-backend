import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { JwtPayload, Tokens } from './interfaces/jwt-payload.interface';
import { User, UserRole } from '../users/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OTPResponseDto, TokensResponseDto } from './dto/auth-response.dto';
import { OTPDto, RegisterOrganizationDto } from './dto/auth.dto';

import { EmailService } from "../../shared/services/email.service";
import { RedisService } from 'src/shared/cache/redis/redis.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const OTP_EXPIRY_MINUTES = 10;

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
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly redisService: RedisService
  ) {
    this.accessSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    this.accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m');
    this.refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }


  /** ----------- Request OTP Service --------- */

  async requestOTP(otpDto: OTPDto): Promise<OTPResponseDto> {
    const { email } = otpDto;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (!existingUser) {
      throw new ConflictException('Invalid Email');
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const redisKey = `otp:${email}`;
    const OTP_EXPIRY_SECONDS = 600;

    await this.redisService.set(redisKey, hashedOtp, OTP_EXPIRY_SECONDS);

    await this.emailService.sendOtpEmail(email, otp, `${existingUser.firstName} ${existingUser.lastName}`,);

    this.logger.log(`OTP sent and cached for ${email}`);

    return {
      message: 'Check your email for the OTP. It expires in 10 minutes.',
    };
  }


  /** ----------- Register Organization And User Service --------- */

  async registerOrganization(dto: RegisterOrganizationDto): Promise<any> {
    const { workEmail, firstName, lastName, mobileNo, designation, organizationName, organizationType, organizationSize, website, } = dto;

    const existingUser = await this.userRepository.existsBy({ email: workEmail });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    return await this.dataSource.transaction(async (manager) => {
      const organization = manager.create(Organization, {
        organizationName,
        organizationType,
        organizationSize,
        website,
      });

      const savedOrganization = await manager.save(organization);

      // 2️⃣ Create User (Owner of Org)
      const user = manager.create(User, {
        firstName,
        lastName,
        email: workEmail,
        mobileNo,
        designation,
        organization: savedOrganization,
        roles: [UserRole.OWNER],
      });

      const savedUser = await manager.save(user);

      return {
        message: 'Organization registered successfully',
        data: {
          organization: savedOrganization,
          user: savedUser.toSafeObject(),
        },
      };
    });
  }

  async logout(userId: string): Promise<void> {
    const result = await this.userRepository.update(
      { id: userId },
      { hashedRefreshToken: null },
    );

    if (result.affected === 0) {
      this.logger.warn(`Logout called for user ${userId} with no active session`);
    } else {
      this.logger.log(`User ${userId} logged out`);
    }
  }


  async refreshTokens(
    userId: string,
    email: string,
    roles: string[],
    incomingRefreshToken: string,
  ): Promise<TokensResponseDto> {
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

    const tokenMatches = await bcrypt.compare(
      incomingRefreshToken,
      user.hashedRefreshToken,
    );

    if (!tokenMatches) {
      await this.userRepository.update(userId, { hashedRefreshToken: null });
      this.logger.warn(`Possible refresh token reuse detected for user: ${userId}`);
      throw new ForbiddenException(
        'Refresh token has already been used. Please log in again.',
      );
    }

    this.logger.log(`Tokens refreshed for user: ${userId}`);

    const tokens = await this.generateTokens(userId, email, roles);
    await this.storeRefreshToken(userId, tokens.refreshToken);

    return tokens;
  }


  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.toSafeObject();
  }


  private async generateTokens(
    userId: string,
    email: string,
    roles: string[],
  ): Promise<Tokens> {
    const payload: JwtPayload = { sub: userId, email, roles };

    const accessOptions: any = {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    };

    const refreshOptions: any = {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessOptions),
      this.jwtService.signAsync(payload, refreshOptions),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { hashedRefreshToken });
  }

  private async handleFailedLogin(user: User): Promise<void> {
    const newFailedAttempts = user.failedLoginAttempts + 1;

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      await this.userRepository.update(user.id, {
        failedLoginAttempts: newFailedAttempts,
        lockedUntil,
      });
      this.logger.warn(`Account locked for ${LOCK_DURATION_MINUTES} minutes: ${user.email}`);
    } else {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: newFailedAttempts,
      });
    }
  }
}