import { Type } from 'class-transformer';
import {
  IsDateString,
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
import { WorkLogTargetType } from '../entities/work-log.entity';

export class CreateWorkLogDto {
  @ApiProperty({ enum: WorkLogTargetType })
  @IsEnum(WorkLogTargetType)
  targetType: WorkLogTargetType;

  @ApiProperty({ description: 'Target task, subtask, or issue ID' })
  @IsUUID(4)
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({ example: '2026-05-31', description: 'Work log date in YYYY-MM-DD format' })
  @IsDateString()
  logDate: string;

  @ApiProperty({ example: 90, description: 'Time spent in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minutesSpent: number;

  @ApiPropertyOptional({ example: 'Implemented validation and fixed review notes' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'User ID to log time for. Defaults to current user.' })
  @IsUUID(4)
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN context' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class UpdateWorkLogDto extends PartialType(CreateWorkLogDto) {}

export class WorkLogListQueryDto {
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

  @ApiPropertyOptional({ enum: WorkLogTargetType })
  @IsEnum(WorkLogTargetType)
  @IsOptional()
  targetType?: WorkLogTargetType;

  @ApiPropertyOptional({ description: 'Target task, subtask, or issue ID' })
  @IsUUID(4)
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID(4)
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by feature ID' })
  @IsUUID(4)
  @IsOptional()
  featureId?: string;

  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsUUID(4)
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Filter by subtask ID' })
  @IsUUID(4)
  @IsOptional()
  subTaskId?: string;

  @ApiPropertyOptional({ description: 'Filter by issue ID' })
  @IsUUID(4)
  @IsOptional()
  issueId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsUUID(4)
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-05-01' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-05-31' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ default: 'logDate' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'logDate';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN filtering' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class WorkLogReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID(4)
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsUUID(4)
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-05-31', description: 'Anchor date for daily/weekly/monthly report' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN filtering' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}
