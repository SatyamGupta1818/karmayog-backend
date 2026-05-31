import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateSubTaskDto, SubTaskListQueryDto, UpdateSubTaskDto } from './dto/subtasks.dto';
import { SubTask, SubTaskPriority, SubTaskStatus } from './entities/sub-task.entity';

const SUB_TASK_SORT_COLUMNS = {
  title: 'subTask.title',
  status: 'subTask.status',
  priority: 'subTask.priority',
  startDate: 'subTask.startDate',
  dueDate: 'subTask.dueDate',
  budgetMinutes: 'subTask.budgetMinutes',
  isActive: 'subTask.isActive',
  createdAt: 'subTask.createdAt',
  updatedAt: 'subTask.updatedAt',
} as const;

@Injectable()
export class SubTasksService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'subtask:';
  private readonly LIST_CACHE_PREFIX = 'subtasks:list:';

  constructor(
    @InjectRepository(SubTask)
    private readonly subTaskRepo: Repository<SubTask>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateSubTaskDto, orgId: string, createdById: string): Promise<SubTask> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a subtask');
    }

    this.validateDates(createDto.startDate, createDto.dueDate);
    const task = await this.ensureTask(createDto.taskId, orgId);

    const existing = await this.subTaskRepo.findOne({
      where: {
        title: createDto.title,
        taskId: createDto.taskId,
        organizationId: orgId,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new BadRequestException('Subtask with this title already exists in the selected task');
    }

    if (createDto.assignedToId) {
      await this.ensureUser(createDto.assignedToId, orgId);
    }

    const subTask = this.subTaskRepo.create({
      title: createDto.title,
      description: createDto.description,
      status: createDto.status || SubTaskStatus.TODO,
      priority: createDto.priority || SubTaskPriority.MEDIUM,
      startDate: createDto.startDate,
      dueDate: createDto.dueDate,
      budgetMinutes: createDto.budgetMinutes || 0,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: task.projectId },
      projectId: task.projectId,
      feature: { id: task.featureId },
      featureId: task.featureId,
      task: { id: task.id },
      taskId: task.id,
      assignedTo: createDto.assignedToId ? { id: createDto.assignedToId } : undefined,
      assignedToId: createDto.assignedToId,
      createdBy: { id: createdById },
      createdById,
    });

    const saved = await this.subTaskRepo.save(subTask);
    await this.clearListCache(orgId);
    return saved;
  }

  async findAll(query: SubTaskListQueryDto, orgId?: string) {
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
      taskId,
      status,
      priority,
      assignedToId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.subTaskRepo
      .createQueryBuilder('subTask')
      .leftJoinAndSelect('subTask.project', 'project')
      .leftJoinAndSelect('subTask.feature', 'feature')
      .leftJoinAndSelect('subTask.task', 'task')
      .leftJoinAndSelect('subTask.assignedTo', 'assignedTo')
      .leftJoinAndSelect('subTask.createdBy', 'createdBy')
      .where('subTask.is_deleted = false');

    if (orgId) qb.andWhere('subTask.organization_id = :orgId', { orgId });
    if (projectId) qb.andWhere('subTask.project_id = :projectId', { projectId });
    if (featureId) qb.andWhere('subTask.feature_id = :featureId', { featureId });
    if (taskId) qb.andWhere('subTask.task_id = :taskId', { taskId });
    if (status) qb.andWhere('subTask.status = :status', { status });
    if (priority) qb.andWhere('subTask.priority = :priority', { priority });
    if (assignedToId) qb.andWhere('subTask.assigned_to = :assignedToId', { assignedToId });
    if (isActive !== undefined) qb.andWhere('subTask.is_active = :isActive', { isActive });
    if (search) {
      qb.andWhere('(subTask.title ILIKE :search OR subTask.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(SUB_TASK_SORT_COLUMNS[sortBy] || SUB_TASK_SORT_COLUMNS.createdAt, sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<SubTask> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<SubTask>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const subTask = await this.subTaskRepo.findOne({
      where: whereClause,
      relations: ['project', 'feature', 'task', 'assignedTo', 'createdBy'],
    });

    if (!subTask) {
      throw new NotFoundException(`Subtask with ID ${id} not found`);
    }

    const safeSubTask = this.sanitizeUsers(subTask);
    await this.redisService.set(cacheKey, safeSubTask, this.CACHE_TTL);
    return safeSubTask;
  }

  async update(id: string, updateDto: UpdateSubTaskDto, orgId?: string): Promise<SubTask> {
    const subTask = await this.findOne(id, orgId);
    const effectiveOrgId = orgId || subTask.organizationId;
    const targetTaskId = updateDto.taskId || subTask.taskId;

    this.validateDates(updateDto.startDate || subTask.startDate, updateDto.dueDate || subTask.dueDate);
    const task = await this.ensureTask(targetTaskId, effectiveOrgId);

    if ((updateDto.title && updateDto.title !== subTask.title) || targetTaskId !== subTask.taskId) {
      const existing = await this.subTaskRepo.findOne({
        where: {
          title: updateDto.title || subTask.title,
          taskId: targetTaskId,
          organizationId: effectiveOrgId,
          isDeleted: false,
        },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Subtask with this title already exists in the selected task');
      }
    }

    if (updateDto.assignedToId) {
      await this.ensureUser(updateDto.assignedToId, effectiveOrgId);
      subTask.assignedTo = { id: updateDto.assignedToId } as any;
      subTask.assignedToId = updateDto.assignedToId;
    }

    if (updateDto.taskId) {
      subTask.task = { id: task.id } as any;
      subTask.taskId = task.id;
      subTask.feature = { id: task.featureId } as any;
      subTask.featureId = task.featureId;
      subTask.project = { id: task.projectId } as any;
      subTask.projectId = task.projectId;
    }
    if (updateDto.title !== undefined) subTask.title = updateDto.title;
    if (updateDto.description !== undefined) subTask.description = updateDto.description;
    if (updateDto.status !== undefined) subTask.status = updateDto.status;
    if (updateDto.priority !== undefined) subTask.priority = updateDto.priority;
    if (updateDto.startDate !== undefined) subTask.startDate = updateDto.startDate;
    if (updateDto.dueDate !== undefined) subTask.dueDate = updateDto.dueDate;
    if (updateDto.budgetMinutes !== undefined) subTask.budgetMinutes = updateDto.budgetMinutes;
    if (updateDto.isActive !== undefined) subTask.isActive = updateDto.isActive;

    const updated = await this.subTaskRepo.save(subTask);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId?: string) {
    const subTask = await this.findOne(id, orgId);
    subTask.isDeleted = true;
    subTask.isActive = false;

    await this.subTaskRepo.save(subTask);
    await this.clearCache(id, orgId || subTask.organizationId);
    return { message: 'Subtask successfully deleted' };
  }

  private async ensureTask(taskId: string, orgId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, organizationId: orgId, isDeleted: false },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${taskId} not found in your organization`);
    }
    return task;
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

  private sanitizeUsers(subTask: SubTask) {
    if (subTask.createdBy && typeof subTask.createdBy.toSafeObject === 'function') {
      subTask.createdBy = subTask.createdBy.toSafeObject();
    }
    if (subTask.assignedTo && typeof subTask.assignedTo.toSafeObject === 'function') {
      subTask.assignedTo = subTask.assignedTo.toSafeObject();
    }
    return subTask;
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
