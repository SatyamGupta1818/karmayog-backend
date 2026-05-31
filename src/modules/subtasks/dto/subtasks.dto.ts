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
import { SubTaskPriority, SubTaskStatus } from '../entities/sub-task.entity';

export class CreateSubTaskDto {
  @ApiProperty({ example: 'Verify client documents' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Check GST, PAN, and onboarding form' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: SubTaskStatus, default: SubTaskStatus.TODO })
  @IsEnum(SubTaskStatus)
  @IsOptional()
  status?: SubTaskStatus;

  @ApiPropertyOptional({ enum: SubTaskPriority, default: SubTaskPriority.MEDIUM })
  @IsEnum(SubTaskPriority)
  @IsOptional()
  priority?: SubTaskPriority;

  @ApiProperty({ description: 'Parent task ID' })
  @IsUUID(4)
  @IsNotEmpty()
  taskId: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-03T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 120, description: 'Allocated time budget in minutes' })
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

export class UpdateSubTaskDto extends PartialType(CreateSubTaskDto) {
  @ApiPropertyOptional({ description: 'Whether the subtask is active or archived' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class SubTaskListQueryDto {
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

  @ApiPropertyOptional({ description: 'Search in title or description' })
  @IsString()
  @IsOptional()
  search?: string;

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

  @ApiPropertyOptional({ enum: SubTaskStatus })
  @IsEnum(SubTaskStatus)
  @IsOptional()
  status?: SubTaskStatus;

  @ApiPropertyOptional({ enum: SubTaskPriority })
  @IsEnum(SubTaskPriority)
  @IsOptional()
  priority?: SubTaskPriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter active/archived subtasks' })
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
