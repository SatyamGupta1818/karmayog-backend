import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsArray,
  IsEnum,
  IsBoolean,
  IsDate,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ProjectStatus } from '../entities/project.entity';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign', description: 'Name of the project' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Complete overhaul of the main website', description: 'Description of the project' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.PLANNING, description: 'Status of the project' })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2023-12-01T00:00:00Z', description: 'Start date of the project' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2024-06-01T00:00:00Z', description: 'End date of the project' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endDate?: Date;

  @ApiPropertyOptional({ example: 12000, description: 'Allocated project time budget in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  budgetMinutes?: number;

  @ApiPropertyOptional({ description: 'Department ID associated with the project' })
  @IsUUID(4)
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ type: [String], description: 'Team IDs assigned to the project' })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  teamIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'User IDs of the project members' })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  memberIds?: string[];

  @ApiPropertyOptional({ description: 'Organization ID (Optional, inferred from token for non-super admins)' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ description: 'Whether the project is active or archived' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ProjectListQueryDto {
  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term for project name or description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, description: 'Filter by project status' })
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Filter by department ID' })
  @IsUUID(4)
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'Filter by team ID' })
  @IsUUID(4)
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Filter by member ID' })
  @IsUUID(4)
  @IsOptional()
  memberId?: string;

  @ApiPropertyOptional({ description: 'Filter active/archived projects' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Field to sort by', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order (ASC or DESC)', default: 'DESC' })
  @IsString()
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @ApiPropertyOptional({ description: 'Organization ID (for SUPER_ADMIN filtering)' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}
