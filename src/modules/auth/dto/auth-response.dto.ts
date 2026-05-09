import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Generic ───────────────────────────────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

// ─── OTP ──────────────────────────────────────────────────────────────────────

export class OTPResponseDto {
  @ApiProperty({ example: 'Check your email for the OTP. It expires in 10 minutes.' })
  message: string;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

export class TokensResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export class UserResponseDto {
  @ApiProperty({ example: 'uuid-v4' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'john.doe@company.com' })
  email: string;

  @ApiProperty({ example: '+919876543210' })
  mobileNo: string;

  @ApiProperty({ example: 'Engineering Manager' })
  designation: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}

// ─── Login (OTP verify response) ──────────────────────────────────────────────

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

// ─── Organization Registration ─────────────────────────────────────────────────

export class OrganizationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  organizationType: string;

  @ApiProperty()
  organizationSize: string;

  @ApiProperty()
  orgEmail: string;

  @ApiProperty()
  createdAt: Date;
}

export class RegisterOrganizationResponseDto {
  @ApiProperty({ example: 'Organization registered successfully' })
  message: string;

  @ApiProperty()
  data: {
    organization: OrganizationDto;
    user: UserResponseDto;
  };
}