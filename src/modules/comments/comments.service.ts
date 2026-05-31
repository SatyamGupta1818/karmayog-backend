import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Feature } from '../features/entities/feature.entity';
import { Issue } from '../issues/entities/issue.entity';
import { Project } from '../projects/entities/project.entity';
import { SubTask } from '../subtasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { CreateCommentDto, CommentListQueryDto, UpdateCommentDto } from './dto/comments.dto';
import { Comment, CommentTargetType } from './entities/comment.entity';

const COMMENT_SORT_COLUMNS = {
  createdAt: 'comment.createdAt',
  updatedAt: 'comment.updatedAt',
} as const;

interface CommentTargetContext {
  projectId: string;
}

@Injectable()
export class CommentsService {
  private readonly CACHE_TTL = 1800;
  private readonly CACHE_PREFIX = 'comment:';
  private readonly LIST_CACHE_PREFIX = 'comments:list:';
  private readonly MODERATOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'];

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(SubTask)
    private readonly subTaskRepo: Repository<SubTask>,
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateCommentDto, orgId: string, createdById: string): Promise<Comment> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a comment');
    }

    const target = await this.resolveTarget(createDto.targetType, createDto.targetId, orgId);
    const comment = this.commentRepo.create({
      body: createDto.body,
      targetType: createDto.targetType,
      targetId: createDto.targetId,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: target.projectId },
      projectId: target.projectId,
      createdBy: { id: createdById },
      createdById,
    });

    const saved = await this.commentRepo.save(comment);
    await this.clearListCache(orgId);
    return saved;
  }

  async findAll(query: CommentListQueryDto, orgId?: string) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${orgId || 'all'}:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const {
      page = 1,
      limit = 10,
      targetType,
      targetId,
      projectId,
      createdById,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.commentRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.createdBy', 'createdBy')
      .where('comment.is_deleted = false');

    if (orgId) qb.andWhere('comment.organization_id = :orgId', { orgId });
    if (targetType) qb.andWhere('comment.target_type = :targetType', { targetType });
    if (targetId) qb.andWhere('comment.target_id = :targetId', { targetId });
    if (projectId) qb.andWhere('comment.project_id = :projectId', { projectId });
    if (createdById) qb.andWhere('comment.created_by = :createdById', { createdById });

    qb.orderBy(COMMENT_SORT_COLUMNS[sortBy] || COMMENT_SORT_COLUMNS.createdAt, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    const result = {
      items: items.map((item) => this.sanitizeUsers(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findOne(id: string, orgId?: string): Promise<Comment> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<Comment>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const comment = await this.loadComment(id, orgId);
    const safeComment = this.sanitizeUsers(comment);
    await this.redisService.set(cacheKey, safeComment, this.CACHE_TTL);
    return safeComment;
  }

  async update(id: string, updateDto: UpdateCommentDto, orgId: string | undefined, user: AuthenticatedUser): Promise<Comment> {
    const comment = await this.loadComment(id, orgId);
    this.ensureCanModify(comment, user);

    const targetType = updateDto.targetType || comment.targetType;
    const targetId = updateDto.targetId || comment.targetId;

    if (updateDto.targetType !== undefined || updateDto.targetId !== undefined) {
      const target = await this.resolveTarget(targetType, targetId, orgId || comment.organizationId);
      comment.targetType = targetType;
      comment.targetId = targetId;
      comment.project = { id: target.projectId } as any;
      comment.projectId = target.projectId;
    }
    if (updateDto.body !== undefined) {
      comment.body = updateDto.body;
    }

    const updated = await this.commentRepo.save(comment);
    await this.clearCache(id, orgId || comment.organizationId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId: string | undefined, user: AuthenticatedUser) {
    const comment = await this.loadComment(id, orgId);
    this.ensureCanModify(comment, user);

    comment.isDeleted = true;
    await this.commentRepo.save(comment);
    await this.clearCache(id, orgId || comment.organizationId);
    return { message: 'Comment successfully deleted' };
  }

  private async resolveTarget(
    targetType: CommentTargetType,
    targetId: string,
    orgId: string,
  ): Promise<CommentTargetContext> {
    switch (targetType) {
      case CommentTargetType.PROJECT: {
        const project = await this.projectRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!project) {
          throw new NotFoundException(`Project with ID ${targetId} not found in your organization`);
        }
        return { projectId: project.id };
      }
      case CommentTargetType.FEATURE: {
        const feature = await this.featureRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!feature) {
          throw new NotFoundException(`Feature with ID ${targetId} not found in your organization`);
        }
        return { projectId: feature.projectId };
      }
      case CommentTargetType.TASK: {
        const task = await this.taskRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!task) {
          throw new NotFoundException(`Task with ID ${targetId} not found in your organization`);
        }
        return { projectId: task.projectId };
      }
      case CommentTargetType.SUB_TASK: {
        const subTask = await this.subTaskRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!subTask) {
          throw new NotFoundException(`Subtask with ID ${targetId} not found in your organization`);
        }
        return { projectId: subTask.projectId };
      }
      case CommentTargetType.ISSUE: {
        const issue = await this.issueRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!issue) {
          throw new NotFoundException(`Issue with ID ${targetId} not found in your organization`);
        }
        return { projectId: issue.projectId };
      }
      default:
        throw new BadRequestException('Unsupported comment target type');
    }
  }

  private async loadComment(id: string, orgId?: string): Promise<Comment> {
    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const comment = await this.commentRepo.findOne({
      where: whereClause,
      relations: ['createdBy'],
    });
    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }
    return comment;
  }

  private ensureCanModify(comment: Comment, user: AuthenticatedUser) {
    const isOwner = comment.createdById === user.userId;
    const isModerator = user.roles.some((role) => this.MODERATOR_ROLES.includes(role));
    if (!isOwner && !isModerator) {
      throw new ForbiddenException('You can only update or delete your own comments');
    }
  }

  private sanitizeUsers(comment: Comment) {
    if (comment.createdBy && typeof comment.createdBy.toSafeObject === 'function') {
      comment.createdBy = comment.createdBy.toSafeObject();
    }
    return comment;
  }

  private async clearCache(id: string, orgId: string) {
    await this.redisService.del(this.getCacheKey(id, orgId));
    await this.redisService.del(this.getCacheKey(id, 'all'));
    await this.clearListCache(orgId);
  }

  private async clearListCache(orgId: string) {
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}${orgId}:*`);
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}all:*`);
  }

  private getCacheKey(id: string, orgId?: string) {
    return `${this.CACHE_PREFIX}${orgId || 'all'}:${id}`;
  }
}
