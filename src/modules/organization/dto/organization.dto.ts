import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SubscriptionType } from '../entities/organization.entity';

export const ORGANIZATION_SORT_FIELDS = [
  'organizationName',
  'organizationType',
  'organizationSize',
  'orgEmail',
  'subscriptionType',
  'isSubscriptionTaken',
  'isActive',
  'createdAt',
  'updatedAt',
] as const;

export type OrganizationSortField = (typeof ORGANIZATION_SORT_FIELDS)[number];

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};
const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

export class CreateOrganizationDto {
  @ApiProperty({ example: 'StackTech' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Transform(trimValue)
  organizationName: string;

  @ApiProperty({ example: 'startup' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Transform(trimValue)
  organizationType: string;

  @ApiProperty({ example: '51-200' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(20)
  @Transform(trimValue)
  organizationSize: string;

  @ApiPropertyOptional({ example: 'contact@stacktech.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid organization email' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  orgEmail?: string;

  @ApiPropertyOptional({ example: 'https://stacktech.com' })
  @IsOptional()
  @IsUrl(
    { require_protocol: false },
    { message: 'Please provide a valid website URL' },
  )
  @MaxLength(255)
  @Transform(trimValue)
  website?: string;

  @ApiPropertyOptional({
    enum: SubscriptionType,
    example: SubscriptionType.FREE,
  })
  @IsOptional()
  @IsEnum(SubscriptionType)
  subscriptionType?: SubscriptionType;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isSubscriptionTaken?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class OrganizationListQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Stack' })
  @IsOptional()
  @IsString()
  @Transform(trimValue)
  search?: string;

  @ApiPropertyOptional({ enum: SubscriptionType })
  @IsOptional()
  @IsEnum(SubscriptionType)
  subscriptionType?: SubscriptionType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isSubscriptionTaken?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ORGANIZATION_SORT_FIELDS, example: 'createdAt' })
  @IsOptional()
  @IsIn(ORGANIZATION_SORT_FIELDS)
  sortBy?: OrganizationSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
