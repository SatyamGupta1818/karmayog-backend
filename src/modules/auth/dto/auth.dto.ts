import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsNumberString,
  Length,
} from 'class-validator';

// ─── OTP ──────────────────────────────────────────────────────────────────────

export class OTPDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOTPDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '482910', description: '6-digit OTP sent to email' })
  @IsNumberString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}

// ─── Organization Registration ─────────────────────────────────────────────────

export enum OrganizationType {
  STARTUP = 'startup',
  SME = 'sme',
  ENTERPRISE = 'enterprise',
  NON_PROFIT = 'non_profit',
  GOVERNMENT = 'government',
  OTHER = 'other',
}

export enum OrganizationSize {
  MICRO = '1-10',
  SMALL = '11-50',
  MEDIUM = '51-200',
  LARGE = '201-1000',
  ENTERPRISE = '1000+',
}

export class RegisterOrganizationDto {
  // ── User fields ──────────────────────────────────────────────────────────

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName: string;

  @ApiProperty({ example: 'john.doe@company.com' })
  @IsEmail()
  @IsNotEmpty()
  workEmail: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  mobileNo: string;

  @ApiProperty({ example: 'Engineering Manager' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  designation: string;

  // ── Organization fields ────────────────────────────────────────────────

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  organizationName: string;

  @ApiProperty({ enum: OrganizationType, example: OrganizationType.STARTUP })
  @IsEnum(OrganizationType)
  organizationType: OrganizationType;

  @ApiProperty({ enum: OrganizationSize, example: OrganizationSize.SMALL })
  @IsEnum(OrganizationSize)
  organizationSize: OrganizationSize;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  orgEmail: string;
}