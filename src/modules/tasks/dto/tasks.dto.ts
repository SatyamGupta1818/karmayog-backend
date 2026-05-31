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
import { TaskPriority, TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @ApiProperty({ example: 'Prepare kickoff checklist' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Draft checklist and share with operations lead' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ description: 'Feature ID this task belongs to' })
  @IsUUID(4)
  @IsNotEmpty()
  featureId: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-05T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 480, description: 'Allocated time budget in minutes' })
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

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ description: 'Whether the task is active or archived' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class TaskListQueryDto {
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

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter active/archived tasks' })
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
