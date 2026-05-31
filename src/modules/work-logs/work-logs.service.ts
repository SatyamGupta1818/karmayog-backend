import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../shared/cache/redis/redis.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { Issue } from '../issues/entities/issue.entity';
import { SubTask } from '../subtasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateWorkLogDto, UpdateWorkLogDto, WorkLogListQueryDto, WorkLogReportQueryDto } from './dto/work-logs.dto';
import { WorkLog, WorkLogTargetType } from './entities/work-log.entity';

const WORK_LOG_SORT_COLUMNS = {
  logDate: 'workLog.logDate',
  minutesSpent: 'workLog.minutesSpent',
  createdAt: 'workLog.createdAt',
  updatedAt: 'workLog.updatedAt',
} as const;

interface WorkLogTargetContext {
  projectId: string;
  featureId?: string;
  taskId?: string;
  subTaskId?: string;
  issueId?: string;
}

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

@Injectable()
export class WorkLogsService {
  private readonly CACHE_TTL = 1800;
  private readonly REPORT_CACHE_TTL = 900;
  private readonly CACHE_PREFIX = 'work-log:';
  private readonly LIST_CACHE_PREFIX = 'work-logs:list:';
  private readonly REPORT_CACHE_PREFIX = 'work-logs:report:v2:';
  private readonly MODERATOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TEAM_LEADER'];

  constructor(
    @InjectRepository(WorkLog)
    private readonly workLogRepo: Repository<WorkLog>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(SubTask)
    private readonly subTaskRepo: Repository<SubTask>,
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateWorkLogDto, orgId: string, currentUser: AuthenticatedUser): Promise<WorkLog> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a work log');
    }

    const logUserId = createDto.userId || currentUser.userId;
    this.ensureCanLogForUser(logUserId, currentUser);
    await this.ensureUser(logUserId, orgId);

    const target = await this.resolveTarget(createDto.targetType, createDto.targetId, orgId);
    const workLog = this.workLogRepo.create({
      description: createDto.description,
      logDate: createDto.logDate,
      minutesSpent: createDto.minutesSpent,
      targetType: createDto.targetType,
      targetId: createDto.targetId,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: target.projectId },
      projectId: target.projectId,
      feature: target.featureId ? { id: target.featureId } : undefined,
      featureId: target.featureId,
      task: target.taskId ? { id: target.taskId } : undefined,
      taskId: target.taskId,
      subTask: target.subTaskId ? { id: target.subTaskId } : undefined,
      subTaskId: target.subTaskId,
      issue: target.issueId ? { id: target.issueId } : undefined,
      issueId: target.issueId,
      user: { id: logUserId },
      userId: logUserId,
    });

    const saved = await this.workLogRepo.save(workLog);
    await this.clearListAndReportCache(orgId);
    return saved;
  }

  async findAll(query: WorkLogListQueryDto, orgId?: string) {
    this.validateRange(query.fromDate, query.toDate);
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
      featureId,
      taskId,
      subTaskId,
      issueId,
      userId,
      fromDate,
      toDate,
      sortBy = 'logDate',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.workLogRepo
      .createQueryBuilder('workLog')
      .leftJoinAndSelect('workLog.user', 'user')
      .where('workLog.is_deleted = false');

    if (orgId) qb.andWhere('workLog.organization_id = :orgId', { orgId });
    if (targetType) qb.andWhere('workLog.target_type = :targetType', { targetType });
    if (targetId) qb.andWhere('workLog.target_id = :targetId', { targetId });
    if (projectId) qb.andWhere('workLog.project_id = :projectId', { projectId });
    if (featureId) qb.andWhere('workLog.feature_id = :featureId', { featureId });
    if (taskId) qb.andWhere('workLog.task_id = :taskId', { taskId });
    if (subTaskId) qb.andWhere('workLog.sub_task_id = :subTaskId', { subTaskId });
    if (issueId) qb.andWhere('workLog.issue_id = :issueId', { issueId });
    if (userId) qb.andWhere('workLog.user_id = :userId', { userId });
    if (fromDate) qb.andWhere('workLog.log_date >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('workLog.log_date <= :toDate', { toDate });

    qb.orderBy(WORK_LOG_SORT_COLUMNS[sortBy] || WORK_LOG_SORT_COLUMNS.logDate, sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<WorkLog> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<WorkLog>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const workLog = await this.loadWorkLog(id, orgId);
    const safeWorkLog = this.sanitizeUsers(workLog);
    await this.redisService.set(cacheKey, safeWorkLog, this.CACHE_TTL);
    return safeWorkLog;
  }

  async update(
    id: string,
    updateDto: UpdateWorkLogDto,
    orgId: string | undefined,
    currentUser: AuthenticatedUser,
  ): Promise<WorkLog> {
    const workLog = await this.loadWorkLog(id, orgId);
    this.ensureCanModify(workLog, currentUser);

    const effectiveOrgId = orgId || workLog.organizationId;
    const targetChanged = updateDto.targetType !== undefined || updateDto.targetId !== undefined;
    if (targetChanged && (!updateDto.targetType || !updateDto.targetId)) {
      throw new BadRequestException('Both targetType and targetId are required when moving a work log');
    }

    if (targetChanged) {
      const target = await this.resolveTarget(updateDto.targetType as WorkLogTargetType, updateDto.targetId as string, effectiveOrgId);
      workLog.targetType = updateDto.targetType as WorkLogTargetType;
      workLog.targetId = updateDto.targetId as string;
      workLog.project = { id: target.projectId } as any;
      workLog.projectId = target.projectId;
      workLog.feature = target.featureId ? ({ id: target.featureId } as any) : undefined;
      workLog.featureId = target.featureId;
      workLog.task = target.taskId ? ({ id: target.taskId } as any) : undefined;
      workLog.taskId = target.taskId;
      workLog.subTask = target.subTaskId ? ({ id: target.subTaskId } as any) : undefined;
      workLog.subTaskId = target.subTaskId;
      workLog.issue = target.issueId ? ({ id: target.issueId } as any) : undefined;
      workLog.issueId = target.issueId;
    }

    if (updateDto.userId) {
      this.ensureCanLogForUser(updateDto.userId, currentUser);
      await this.ensureUser(updateDto.userId, effectiveOrgId);
      workLog.user = { id: updateDto.userId } as any;
      workLog.userId = updateDto.userId;
    }
    if (updateDto.description !== undefined) workLog.description = updateDto.description;
    if (updateDto.logDate !== undefined) workLog.logDate = updateDto.logDate;
    if (updateDto.minutesSpent !== undefined) workLog.minutesSpent = updateDto.minutesSpent;

    const updated = await this.workLogRepo.save(workLog);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId: string | undefined, currentUser: AuthenticatedUser) {
    const workLog = await this.loadWorkLog(id, orgId);
    this.ensureCanModify(workLog, currentUser);

    workLog.isDeleted = true;
    await this.workLogRepo.save(workLog);
    await this.clearCache(id, orgId || workLog.organizationId);
    return { message: 'Work log successfully deleted' };
  }

  async getDailyReport(query: WorkLogReportQueryDto, orgId?: string) {
    return this.getReport(query, orgId, 'daily');
  }

  async getWeeklyReport(query: WorkLogReportQueryDto, orgId?: string) {
    return this.getReport(query, orgId, 'weekly');
  }

  async getMonthlyReport(query: WorkLogReportQueryDto, orgId?: string) {
    return this.getReport(query, orgId, 'monthly');
  }

  private async getReport(query: WorkLogReportQueryDto, orgId: string | undefined, period: ReportPeriod) {
    const range = this.getPeriodRange(period, query.date);
    const cacheKey = `${this.REPORT_CACHE_PREFIX}${period}:${orgId || 'all'}:${JSON.stringify(query)}:${range.startDate}:${range.endDate}`;
    const cachedData = await this.redisService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const qb = this.workLogRepo
      .createQueryBuilder('workLog')
      .select('workLog.project_id', 'projectId')
      .addSelect('workLog.user_id', 'userId')
      .addSelect('workLog.target_type', 'targetType')
      .addSelect('SUM(workLog.minutes_spent)', 'totalMinutes')
      .where('workLog.is_deleted = false')
      .andWhere('workLog.log_date BETWEEN :startDate AND :endDate', range);

    if (orgId) qb.andWhere('workLog.organization_id = :orgId', { orgId });
    if (query.projectId) qb.andWhere('workLog.project_id = :projectId', { projectId: query.projectId });
    if (query.userId) qb.andWhere('workLog.user_id = :userId', { userId: query.userId });

    qb.groupBy('workLog.project_id')
      .addGroupBy('workLog.user_id')
      .addGroupBy('workLog.target_type')
      .orderBy('SUM(workLog.minutes_spent)', 'DESC');

    const rawItems = await qb.getRawMany();
    const summaryItems = rawItems.map((item) => ({
      projectId: item.projectId,
      userId: item.userId,
      targetType: item.targetType,
      totalMinutes: Number(item.totalMinutes),
      totalHours: Number((Number(item.totalMinutes) / 60).toFixed(2)),
    }));

    const workLogs = await this.getReportWorkLogs(range.startDate, range.endDate, query, orgId);
    const totalMinutes = summaryItems.reduce((sum, item) => sum + item.totalMinutes, 0);
    const result = {
      period,
      startDate: range.startDate,
      endDate: range.endDate,
      totalMinutes,
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      summaryItems,
      items: summaryItems,
      workLogs,
    };

    await this.redisService.set(cacheKey, result, this.REPORT_CACHE_TTL);
    return result;
  }

  private async getReportWorkLogs(
    startDate: string,
    endDate: string,
    query: WorkLogReportQueryDto,
    orgId?: string,
  ) {
    const qb = this.workLogRepo
      .createQueryBuilder('workLog')
      .leftJoinAndSelect('workLog.user', 'user')
      .where('workLog.is_deleted = false')
      .andWhere('workLog.log_date BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (orgId) qb.andWhere('workLog.organization_id = :orgId', { orgId });
    if (query.projectId) qb.andWhere('workLog.project_id = :projectId', { projectId: query.projectId });
    if (query.userId) qb.andWhere('workLog.user_id = :userId', { userId: query.userId });

    qb.orderBy('workLog.logDate', 'DESC').addOrderBy('workLog.createdAt', 'DESC');

    const workLogs = await qb.getMany();
    return workLogs.map((workLog) => {
      const safeWorkLog = this.sanitizeUsers(workLog);

      return {
        id: safeWorkLog.id,
        targetType: safeWorkLog.targetType,
        targetId: safeWorkLog.targetId,
        logDate: safeWorkLog.logDate,
        minutesSpent: safeWorkLog.minutesSpent,
        description: safeWorkLog.description,
        userId: safeWorkLog.userId,
        projectId: safeWorkLog.projectId,
        featureId: safeWorkLog.featureId,
        taskId: safeWorkLog.taskId,
        subTaskId: safeWorkLog.subTaskId,
        issueId: safeWorkLog.issueId,
        user: safeWorkLog.user,
      };
    });
  }

  private async resolveTarget(
    targetType: WorkLogTargetType,
    targetId: string,
    orgId: string,
  ): Promise<WorkLogTargetContext> {
    switch (targetType) {
      case WorkLogTargetType.TASK: {
        const task = await this.taskRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!task) {
          throw new NotFoundException(`Task with ID ${targetId} not found in your organization`);
        }
        return { projectId: task.projectId, featureId: task.featureId, taskId: task.id };
      }
      case WorkLogTargetType.SUB_TASK: {
        const subTask = await this.subTaskRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!subTask) {
          throw new NotFoundException(`Subtask with ID ${targetId} not found in your organization`);
        }
        return {
          projectId: subTask.projectId,
          featureId: subTask.featureId,
          taskId: subTask.taskId,
          subTaskId: subTask.id,
        };
      }
      case WorkLogTargetType.ISSUE: {
        const issue = await this.issueRepo.findOne({
          where: { id: targetId, organizationId: orgId, isDeleted: false },
        });
        if (!issue) {
          throw new NotFoundException(`Issue with ID ${targetId} not found in your organization`);
        }
        return {
          projectId: issue.projectId,
          featureId: issue.featureId,
          taskId: issue.taskId,
          subTaskId: issue.subTaskId,
          issueId: issue.id,
        };
      }
      default:
        throw new BadRequestException('Unsupported work log target type');
    }
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

  private async loadWorkLog(id: string, orgId?: string): Promise<WorkLog> {
    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const workLog = await this.workLogRepo.findOne({
      where: whereClause,
      relations: ['user'],
    });
    if (!workLog) {
      throw new NotFoundException(`Work log with ID ${id} not found`);
    }
    return workLog;
  }

  private ensureCanModify(workLog: WorkLog, user: AuthenticatedUser) {
    const isOwner = workLog.userId === user.userId;
    const isModerator = user.roles.some((role) => this.MODERATOR_ROLES.includes(role));
    if (!isOwner && !isModerator) {
      throw new ForbiddenException('You can only update or delete your own work logs');
    }
  }

  private ensureCanLogForUser(userId: string, user: AuthenticatedUser) {
    const isSelf = userId === user.userId;
    const isModerator = user.roles.some((role) => this.MODERATOR_ROLES.includes(role));
    if (!isSelf && !isModerator) {
      throw new ForbiddenException('You can only add work logs for yourself');
    }
  }

  private validateRange(fromDate?: string, toDate?: string) {
    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('fromDate cannot be after toDate');
    }
  }

  private getPeriodRange(period: ReportPeriod, date?: string) {
    const anchor = date ? new Date(`${date}T00:00:00.000Z`) : new Date();
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
    const end = new Date(start);

    if (period === 'weekly') {
      const day = start.getUTCDay();
      const daysSinceMonday = (day + 6) % 7;
      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
      end.setUTCDate(start.getUTCDate() + 6);
    }

    if (period === 'monthly') {
      start.setUTCDate(1);
      end.setUTCMonth(start.getUTCMonth() + 1, 0);
    }

    return {
      startDate: this.toDateOnly(start),
      endDate: this.toDateOnly(end),
    };
  }

  private toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private sanitizeUsers(workLog: WorkLog) {
    if (workLog.user && typeof workLog.user.toSafeObject === 'function') {
      workLog.user = workLog.user.toSafeObject();
    }
    return workLog;
  }

  private async clearCache(id: string, orgId: string) {
    await this.redisService.del(this.getCacheKey(id, orgId));
    await this.redisService.del(this.getCacheKey(id, 'all'));
    await this.clearListAndReportCache(orgId);
  }

  private async clearListAndReportCache(orgId: string) {
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}${orgId}:*`);
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}all:*`);
    await this.redisService.delByPattern(`${this.REPORT_CACHE_PREFIX}*:${orgId}:*`);
    await this.redisService.delByPattern(`${this.REPORT_CACHE_PREFIX}*:all:*`);
  }

  private getCacheKey(id: string, orgId?: string) {
    return `${this.CACHE_PREFIX}${orgId || 'all'}:${id}`;
  }
}
