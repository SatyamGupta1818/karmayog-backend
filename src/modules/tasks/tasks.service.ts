import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Feature } from '../features/entities/feature.entity';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto/tasks.dto';
import { Task, TaskPriority, TaskStatus } from './entities/task.entity';

const TASK_SORT_COLUMNS = {
  title: 'task.title',
  status: 'task.status',
  priority: 'task.priority',
  startDate: 'task.startDate',
  dueDate: 'task.dueDate',
  budgetMinutes: 'task.budgetMinutes',
  isActive: 'task.isActive',
  createdAt: 'task.createdAt',
  updatedAt: 'task.updatedAt',
} as const;

@Injectable()
export class TasksService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'task:';
  private readonly LIST_CACHE_PREFIX = 'tasks:list:';

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateTaskDto, orgId: string, createdById: string): Promise<Task> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a task');
    }

    this.validateDates(createDto.startDate, createDto.dueDate);
    const feature = await this.ensureFeature(createDto.featureId, orgId);

    const existing = await this.taskRepo.findOne({
      where: {
        title: createDto.title,
        featureId: createDto.featureId,
        organizationId: orgId,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new BadRequestException('Task with this title already exists in the selected feature');
    }

    if (createDto.assignedToId) {
      await this.ensureUser(createDto.assignedToId, orgId);
    }

    const task = this.taskRepo.create({
      title: createDto.title,
      description: createDto.description,
      status: createDto.status || TaskStatus.TODO,
      priority: createDto.priority || TaskPriority.MEDIUM,
      startDate: createDto.startDate,
      dueDate: createDto.dueDate,
      budgetMinutes: createDto.budgetMinutes || 0,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: feature.projectId },
      projectId: feature.projectId,
      feature: { id: feature.id },
      featureId: feature.id,
      assignedTo: createDto.assignedToId ? { id: createDto.assignedToId } : undefined,
      assignedToId: createDto.assignedToId,
      createdBy: { id: createdById },
      createdById,
    });

    const saved = await this.taskRepo.save(task);
    await this.clearListCache(orgId);
    return saved;
  }

  async findAll(query: TaskListQueryDto, orgId?: string) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${orgId || 'all'}:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      featureId,
      status,
      priority,
      assignedToId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.feature', 'feature')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .where('task.is_deleted = false');

    if (orgId) qb.andWhere('task.organization_id = :orgId', { orgId });
    if (projectId) qb.andWhere('task.project_id = :projectId', { projectId });
    if (featureId) qb.andWhere('task.feature_id = :featureId', { featureId });
    if (status) qb.andWhere('task.status = :status', { status });
    if (priority) qb.andWhere('task.priority = :priority', { priority });
    if (assignedToId) qb.andWhere('task.assigned_to = :assignedToId', { assignedToId });
    if (isActive !== undefined) qb.andWhere('task.is_active = :isActive', { isActive });
    if (search) {
      qb.andWhere('(task.title ILIKE :search OR task.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(TASK_SORT_COLUMNS[sortBy] || TASK_SORT_COLUMNS.createdAt, sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<Task> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<Task>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const task = await this.taskRepo.findOne({
      where: whereClause,
      relations: ['project', 'feature', 'assignedTo', 'createdBy'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    const safeTask = this.sanitizeUsers(task);
    await this.redisService.set(cacheKey, safeTask, this.CACHE_TTL);
    return safeTask;
  }

  async update(id: string, updateDto: UpdateTaskDto, orgId?: string): Promise<Task> {
    const task = await this.findOne(id, orgId);
    const effectiveOrgId = orgId || task.organizationId;
    const targetFeatureId = updateDto.featureId || task.featureId;

    this.validateDates(updateDto.startDate || task.startDate, updateDto.dueDate || task.dueDate);
    const feature = await this.ensureFeature(targetFeatureId, effectiveOrgId);

    if ((updateDto.title && updateDto.title !== task.title) || targetFeatureId !== task.featureId) {
      const existing = await this.taskRepo.findOne({
        where: {
          title: updateDto.title || task.title,
          featureId: targetFeatureId,
          organizationId: effectiveOrgId,
          isDeleted: false,
        },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Task with this title already exists in the selected feature');
      }
    }

    if (updateDto.assignedToId) {
      await this.ensureUser(updateDto.assignedToId, effectiveOrgId);
      task.assignedTo = { id: updateDto.assignedToId } as any;
      task.assignedToId = updateDto.assignedToId;
    }

    if (updateDto.featureId) {
      task.feature = { id: feature.id } as any;
      task.featureId = feature.id;
      task.project = { id: feature.projectId } as any;
      task.projectId = feature.projectId;
    }
    if (updateDto.title !== undefined) task.title = updateDto.title;
    if (updateDto.description !== undefined) task.description = updateDto.description;
    if (updateDto.status !== undefined) task.status = updateDto.status;
    if (updateDto.priority !== undefined) task.priority = updateDto.priority;
    if (updateDto.startDate !== undefined) task.startDate = updateDto.startDate;
    if (updateDto.dueDate !== undefined) task.dueDate = updateDto.dueDate;
    if (updateDto.budgetMinutes !== undefined) task.budgetMinutes = updateDto.budgetMinutes;
    if (updateDto.isActive !== undefined) task.isActive = updateDto.isActive;

    const updated = await this.taskRepo.save(task);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId?: string) {
    const task = await this.findOne(id, orgId);
    task.isDeleted = true;
    task.isActive = false;

    await this.taskRepo.save(task);
    await this.clearCache(id, orgId || task.organizationId);
    return { message: 'Task successfully deleted' };
  }

  private async ensureFeature(featureId: string, orgId: string): Promise<Feature> {
    const feature = await this.featureRepo.findOne({
      where: { id: featureId, organizationId: orgId, isDeleted: false },
    });
    if (!feature) {
      throw new NotFoundException(`Feature with ID ${featureId} not found in your organization`);
    }
    return feature;
  }

  private async ensureUser(userId: string, orgId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId, organization: { id: orgId }, isActive: true },
    });
    if (!user) {
      throw new BadRequestException(`User with ID ${userId} could not be found or is inactive`);
    }
    return user;
  }

  private validateDates(startDate?: Date, dueDate?: Date) {
    if (startDate && dueDate && startDate > dueDate) {
      throw new BadRequestException('Due date cannot be before start date');
    }
  }

  private sanitizeUsers(task: Task) {
    if (task.createdBy && typeof task.createdBy.toSafeObject === 'function') {
      task.createdBy = task.createdBy.toSafeObject();
    }
    if (task.assignedTo && typeof task.assignedTo.toSafeObject === 'function') {
      task.assignedTo = task.assignedTo.toSafeObject();
    }
    return task;
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
