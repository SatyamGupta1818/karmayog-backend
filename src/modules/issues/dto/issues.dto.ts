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
import { IssuePriority, IssueSeverity, IssueStatus, IssueType } from '../entities/issue.entity';

export class CreateIssueDto {
  @ApiProperty({ example: 'Login API returns 500 for locked accounts' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'The API should return 423 or a controlled auth error.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: IssueType, default: IssueType.ISSUE })
  @IsEnum(IssueType)
  @IsOptional()
  type?: IssueType;

  @ApiPropertyOptional({ enum: IssueStatus, default: IssueStatus.OPEN })
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority, default: IssuePriority.MEDIUM })
  @IsEnum(IssuePriority)
  @IsOptional()
  priority?: IssuePriority;

  @ApiPropertyOptional({ enum: IssueSeverity, default: IssueSeverity.MINOR })
  @IsEnum(IssueSeverity)
  @IsOptional()
  severity?: IssueSeverity;

  @ApiProperty({ description: 'Project ID this issue belongs to' })
  @IsUUID(4)
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({ description: 'Optional feature ID' })
  @IsUUID(4)
  @IsOptional()
  featureId?: string;

  @ApiPropertyOptional({ description: 'Optional task ID' })
  @IsUUID(4)
  @IsOptional()
  taskId?: string;

  @ApiPropertyOptional({ description: 'Optional subtask ID' })
  @IsUUID(4)
  @IsOptional()
  subTaskId?: string;

  @ApiPropertyOptional({ description: 'Assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-06-04T00:00:00Z' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dueDate?: Date;

  @ApiPropertyOptional({ example: 180, description: 'Allocated time budget in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  budgetMinutes?: number;

  @ApiPropertyOptional({ description: 'Resolution notes' })
  @IsString()
  @IsOptional()
  resolution?: string;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN context' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @ApiPropertyOptional({ description: 'Whether the issue is active or archived' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class IssueListQueryDto {
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

  @ApiPropertyOptional({ description: 'Filter by subtask ID' })
  @IsUUID(4)
  @IsOptional()
  subTaskId?: string;

  @ApiPropertyOptional({ enum: IssueType })
  @IsEnum(IssueType)
  @IsOptional()
  type?: IssueType;

  @ApiPropertyOptional({ enum: IssueStatus })
  @IsEnum(IssueStatus)
  @IsOptional()
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsEnum(IssuePriority)
  @IsOptional()
  priority?: IssuePriority;

  @ApiPropertyOptional({ enum: IssueSeverity })
  @IsEnum(IssueSeverity)
  @IsOptional()
  severity?: IssueSeverity;

  @ApiPropertyOptional({ description: 'Filter by assigned user ID' })
  @IsUUID(4)
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Filter active/archived issues' })
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
