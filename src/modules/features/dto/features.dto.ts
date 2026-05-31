import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FeaturePriority, FeatureStatus } from '../entities/feature.entity';

export class CreateFeatureDto {
  @ApiProperty({ example: 'Client Onboarding', description: 'Feature name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'All work needed to onboard a new client' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: FeatureStatus, default: FeatureStatus.PLANNED })
  @IsEnum(FeatureStatus)
  @IsOptional()
  status?: FeatureStatus;

  @ApiPropertyOptional({ enum: FeaturePriority, default: FeaturePriority.MEDIUM })
  @IsEnum(FeaturePriority)
  @IsOptional()
  priority?: FeaturePriority;

  @ApiProperty({ example: '3bd2f2c6-3db5-4826-a9a2-5b421f2bb13c' })
  @IsUUID(4)
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ description: 'Feature owner user ID' })
  @IsUUID(4)
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-15T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 2400, description: 'Allocated time budget in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  budgetMinutes?: number;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN context' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class UpdateFeatureDto extends PartialType(CreateFeatureDto) {
  @ApiPropertyOptional({ description: 'Whether the feature is active or archived' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class FeatureListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search in feature name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID(4)
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ enum: FeatureStatus })
  @IsEnum(FeatureStatus)
  @IsOptional()
  status?: FeatureStatus;

  @ApiPropertyOptional({ enum: FeaturePriority })
  @IsEnum(FeaturePriority)
  @IsOptional()
  priority?: FeaturePriority;

  @ApiPropertyOptional({ description: 'Filter by owner user ID' })
  @IsUUID(4)
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({ description: 'Filter active/archived features' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN filtering' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}
