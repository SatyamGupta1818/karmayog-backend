import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CommentTargetType } from '../entities/comment.entity';

export class CreateCommentDto {
  @ApiProperty({ example: 'Please attach the latest client approval email.' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ enum: CommentTargetType })
  @IsEnum(CommentTargetType)
  targetType: CommentTargetType;

  @ApiProperty({ description: 'Target project, feature, task, subtask, or issue ID' })
  @IsUUID(4)
  @IsNotEmpty()
  targetId: string;

  @ApiPropertyOptional({ description: 'Organization ID for SUPER_ADMIN context' })
  @IsUUID(4)
  @IsOptional()
  orgId?: string;
}

export class UpdateCommentDto extends PartialType(CreateCommentDto) {}

export class CommentListQueryDto {
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

  @ApiPropertyOptional({ enum: CommentTargetType })
  @IsEnum(CommentTargetType)
  @IsOptional()
  targetType?: CommentTargetType;

  @ApiPropertyOptional({ description: 'Target project, feature, task, subtask, or issue ID' })
  @IsUUID(4)
  @IsOptional()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsUUID(4)
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Filter by comment author' })
  @IsUUID(4)
  @IsOptional()
  createdById?: string;

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
