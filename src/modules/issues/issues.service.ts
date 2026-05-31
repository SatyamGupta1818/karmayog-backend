import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { Feature } from '../features/entities/feature.entity';
import { Project } from '../projects/entities/project.entity';
import { SubTask } from '../subtasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateIssueDto, IssueListQueryDto, UpdateIssueDto } from './dto/issues.dto';
import { Issue, IssuePriority, IssueSeverity, IssueStatus, IssueType } from './entities/issue.entity';

const ISSUE_SORT_COLUMNS = {
  title: 'issue.title',
  type: 'issue.type',
  status: 'issue.status',
  priority: 'issue.priority',
  severity: 'issue.severity',
  startDate: 'issue.startDate',
  dueDate: 'issue.dueDate',
  budgetMinutes: 'issue.budgetMinutes',
  isActive: 'issue.isActive',
  createdAt: 'issue.createdAt',
  updatedAt: 'issue.updatedAt',
} as const;

interface IssueHierarchy {
  projectId: string;
  featureId?: string;
  taskId?: string;
  subTaskId?: string;
}

@Injectable()
export class IssuesService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'issue:';
  private readonly LIST_CACHE_PREFIX = 'issues:list:';

  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(SubTask)
    private readonly subTaskRepo: Repository<SubTask>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateIssueDto, orgId: string, reportedById: string): Promise<Issue> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create an issue or bug');
    }

    this.validateDates(createDto.startDate, createDto.dueDate);
    const hierarchy = await this.resolveHierarchy(
      createDto.projectId,
      createDto.featureId,
      createDto.taskId,
      createDto.subTaskId,
      orgId,
    );

    if (createDto.assignedToId) {
      await this.ensureUser(createDto.assignedToId, orgId);
    }

    const issue = this.issueRepo.create({
      title: createDto.title,
      description: createDto.description,
      type: createDto.type || IssueType.ISSUE,
      status: createDto.status || IssueStatus.OPEN,
      priority: createDto.priority || IssuePriority.MEDIUM,
      severity: createDto.severity || IssueSeverity.MINOR,
      startDate: createDto.startDate,
      dueDate: createDto.dueDate,
      budgetMinutes: createDto.budgetMinutes || 0,
      resolution: createDto.resolution,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: hierarchy.projectId },
      projectId: hierarchy.projectId,
      feature: hierarchy.featureId ? { id: hierarchy.featureId } : undefined,
      featureId: hierarchy.featureId,
      task: hierarchy.taskId ? { id: hierarchy.taskId } : undefined,
      taskId: hierarchy.taskId,
      subTask: hierarchy.subTaskId ? { id: hierarchy.subTaskId } : undefined,
      subTaskId: hierarchy.subTaskId,
      reportedBy: { id: reportedById },
      reportedById,
      assignedTo: createDto.assignedToId ? { id: createDto.assignedToId } : undefined,
      assignedToId: createDto.assignedToId,
    });
    this.applyResolvedAt(issue, issue.status);

    const saved = await this.issueRepo.save(issue);
    await this.clearListCache(orgId);
    return saved;
  }

  async findAll(query: IssueListQueryDto, orgId?: string) {
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
      subTaskId,
      type,
      status,
      priority,
      severity,
      assignedToId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.issueRepo
      .createQueryBuilder('issue')
      .leftJoinAndSelect('issue.project', 'project')
      .leftJoinAndSelect('issue.feature', 'feature')
      .leftJoinAndSelect('issue.task', 'task')
      .leftJoinAndSelect('issue.subTask', 'subTask')
      .leftJoinAndSelect('issue.reportedBy', 'reportedBy')
      .leftJoinAndSelect('issue.assignedTo', 'assignedTo')
      .where('issue.is_deleted = false');

    if (orgId) qb.andWhere('issue.organization_id = :orgId', { orgId });
    if (projectId) qb.andWhere('issue.project_id = :projectId', { projectId });
    if (featureId) qb.andWhere('issue.feature_id = :featureId', { featureId });
    if (taskId) qb.andWhere('issue.task_id = :taskId', { taskId });
    if (subTaskId) qb.andWhere('issue.sub_task_id = :subTaskId', { subTaskId });
    if (type) qb.andWhere('issue.type = :type', { type });
    if (status) qb.andWhere('issue.status = :status', { status });
    if (priority) qb.andWhere('issue.priority = :priority', { priority });
    if (severity) qb.andWhere('issue.severity = :severity', { severity });
    if (assignedToId) qb.andWhere('issue.assigned_to = :assignedToId', { assignedToId });
    if (isActive !== undefined) qb.andWhere('issue.is_active = :isActive', { isActive });
    if (search) {
      qb.andWhere('(issue.title ILIKE :search OR issue.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(ISSUE_SORT_COLUMNS[sortBy] || ISSUE_SORT_COLUMNS.createdAt, sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<Issue> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<Issue>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const issue = await this.issueRepo.findOne({
      where: whereClause,
      relations: ['project', 'feature', 'task', 'subTask', 'reportedBy', 'assignedTo'],
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    const safeIssue = this.sanitizeUsers(issue);
    await this.redisService.set(cacheKey, safeIssue, this.CACHE_TTL);
    return safeIssue;
  }

  async update(id: string, updateDto: UpdateIssueDto, orgId?: string): Promise<Issue> {
    const issue = await this.findOne(id, orgId);
    const effectiveOrgId = orgId || issue.organizationId;

    this.validateDates(updateDto.startDate || issue.startDate, updateDto.dueDate || issue.dueDate);

    if (
      updateDto.projectId !== undefined ||
      updateDto.featureId !== undefined ||
      updateDto.taskId !== undefined ||
      updateDto.subTaskId !== undefined
    ) {
      const hierarchy = await this.resolveHierarchy(
        updateDto.projectId || issue.projectId,
        updateDto.featureId || issue.featureId,
        updateDto.taskId || issue.taskId,
        updateDto.subTaskId || issue.subTaskId,
        effectiveOrgId,
      );

      issue.project = { id: hierarchy.projectId } as any;
      issue.projectId = hierarchy.projectId;
      issue.feature = hierarchy.featureId ? ({ id: hierarchy.featureId } as any) : undefined;
      issue.featureId = hierarchy.featureId;
      issue.task = hierarchy.taskId ? ({ id: hierarchy.taskId } as any) : undefined;
      issue.taskId = hierarchy.taskId;
      issue.subTask = hierarchy.subTaskId ? ({ id: hierarchy.subTaskId } as any) : undefined;
      issue.subTaskId = hierarchy.subTaskId;
    }

    if (updateDto.assignedToId) {
      await this.ensureUser(updateDto.assignedToId, effectiveOrgId);
      issue.assignedTo = { id: updateDto.assignedToId } as any;
      issue.assignedToId = updateDto.assignedToId;
    }

    if (updateDto.title !== undefined) issue.title = updateDto.title;
    if (updateDto.description !== undefined) issue.description = updateDto.description;
    if (updateDto.type !== undefined) issue.type = updateDto.type;
    if (updateDto.status !== undefined) issue.status = updateDto.status;
    if (updateDto.priority !== undefined) issue.priority = updateDto.priority;
    if (updateDto.severity !== undefined) issue.severity = updateDto.severity;
    if (updateDto.startDate !== undefined) issue.startDate = updateDto.startDate;
    if (updateDto.dueDate !== undefined) issue.dueDate = updateDto.dueDate;
    if (updateDto.budgetMinutes !== undefined) issue.budgetMinutes = updateDto.budgetMinutes;
    if (updateDto.resolution !== undefined) issue.resolution = updateDto.resolution;
    if (updateDto.isActive !== undefined) issue.isActive = updateDto.isActive;
    this.applyResolvedAt(issue, issue.status);

    const updated = await this.issueRepo.save(issue);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId?: string) {
    const issue = await this.findOne(id, orgId);
    issue.isDeleted = true;
    issue.isActive = false;

    await this.issueRepo.save(issue);
    await this.clearCache(id, orgId || issue.organizationId);
    return { message: 'Issue successfully deleted' };
  }

  private async resolveHierarchy(
    projectId: string,
    featureId: string | undefined,
    taskId: string | undefined,
    subTaskId: string | undefined,
    orgId: string,
  ): Promise<IssueHierarchy> {
    await this.ensureProject(projectId, orgId);

    if (subTaskId) {
      const subTask = await this.subTaskRepo.findOne({
        where: { id: subTaskId, organizationId: orgId, isDeleted: false },
      });
      if (!subTask) {
        throw new NotFoundException(`Subtask with ID ${subTaskId} not found in your organization`);
      }
      if (subTask.projectId !== projectId) {
        throw new BadRequestException('Subtask does not belong to the selected project');
      }
      if (taskId && subTask.taskId !== taskId) {
        throw new BadRequestException('Subtask does not belong to the selected task');
      }
      if (featureId && subTask.featureId !== featureId) {
        throw new BadRequestException('Subtask does not belong to the selected feature');
      }
      return {
        projectId,
        featureId: subTask.featureId,
        taskId: subTask.taskId,
        subTaskId: subTask.id,
      };
    }

    if (taskId) {
      const task = await this.taskRepo.findOne({
        where: { id: taskId, organizationId: orgId, isDeleted: false },
      });
      if (!task) {
        throw new NotFoundException(`Task with ID ${taskId} not found in your organization`);
      }
      if (task.projectId !== projectId) {
        throw new BadRequestException('Task does not belong to the selected project');
      }
      if (featureId && task.featureId !== featureId) {
        throw new BadRequestException('Task does not belong to the selected feature');
      }
      return {
        projectId,
        featureId: task.featureId,
        taskId: task.id,
      };
    }

    if (featureId) {
      const feature = await this.featureRepo.findOne({
        where: { id: featureId, organizationId: orgId, isDeleted: false },
      });
      if (!feature) {
        throw new NotFoundException(`Feature with ID ${featureId} not found in your organization`);
      }
      if (feature.projectId !== projectId) {
        throw new BadRequestException('Feature does not belong to the selected project');
      }
      return {
        projectId,
        featureId: feature.id,
      };
    }

    return { projectId };
  }

  private async ensureProject(projectId: string, orgId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId, organizationId: orgId, isDeleted: false },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found in your organization`);
    }
    return project;
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

  private applyResolvedAt(issue: Issue, status: IssueStatus) {
    if ([IssueStatus.RESOLVED, IssueStatus.CLOSED].includes(status)) {
      issue.resolvedAt = issue.resolvedAt || new Date();
      return;
    }
    if ([IssueStatus.OPEN, IssueStatus.REOPENED, IssueStatus.IN_PROGRESS].includes(status)) {
      issue.resolvedAt = null as any;
    }
  }

  private sanitizeUsers(issue: Issue) {
    if (issue.reportedBy && typeof issue.reportedBy.toSafeObject === 'function') {
      issue.reportedBy = issue.reportedBy.toSafeObject();
    }
    if (issue.assignedTo && typeof issue.assignedTo.toSafeObject === 'function') {
      issue.assignedTo = issue.assignedTo.toSafeObject();
    }
    return issue;
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
