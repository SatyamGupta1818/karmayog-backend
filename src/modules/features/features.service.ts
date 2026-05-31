import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feature, FeaturePriority, FeatureStatus } from './entities/feature.entity';
import { CreateFeatureDto, FeatureListQueryDto, UpdateFeatureDto } from './dto/features.dto';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

const FEATURE_SORT_COLUMNS = {
  name: 'feature.name',
  status: 'feature.status',
  priority: 'feature.priority',
  startDate: 'feature.startDate',
  dueDate: 'feature.dueDate',
  budgetMinutes: 'feature.budgetMinutes',
  isActive: 'feature.isActive',
  createdAt: 'feature.createdAt',
  updatedAt: 'feature.updatedAt',
} as const;

@Injectable()
export class FeaturesService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'feature:';
  private readonly LIST_CACHE_PREFIX = 'features:list:';

  constructor(
    @InjectRepository(Feature)
    private readonly featureRepo: Repository<Feature>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateFeatureDto, orgId: string, createdById: string): Promise<Feature> {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a feature');
    }

    this.validateDates(createDto.startDate, createDto.dueDate);
    await this.ensureProject(createDto.projectId, orgId);

    const existing = await this.featureRepo.findOne({
      where: {
        name: createDto.name,
        projectId: createDto.projectId,
        organizationId: orgId,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new BadRequestException('Feature with this name already exists in the selected project');
    }

    if (createDto.ownerId) {
      await this.ensureUser(createDto.ownerId, orgId);
    }

    const feature = this.featureRepo.create({
      name: createDto.name,
      description: createDto.description,
      status: createDto.status || FeatureStatus.PLANNED,
      priority: createDto.priority || FeaturePriority.MEDIUM,
      startDate: createDto.startDate,
      dueDate: createDto.dueDate,
      budgetMinutes: createDto.budgetMinutes || 0,
      organization: { id: orgId },
      organizationId: orgId,
      project: { id: createDto.projectId },
      projectId: createDto.projectId,
      owner: createDto.ownerId ? { id: createDto.ownerId } : undefined,
      ownerId: createDto.ownerId,
      createdBy: { id: createdById },
      createdById,
    });

    const saved = await this.featureRepo.save(feature);
    await this.clearListCache(orgId);
    return saved;
  }

  async findAll(query: FeatureListQueryDto, orgId?: string) {
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
      status,
      priority,
      ownerId,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.featureRepo
      .createQueryBuilder('feature')
      .leftJoinAndSelect('feature.project', 'project')
      .leftJoinAndSelect('feature.owner', 'owner')
      .leftJoinAndSelect('feature.createdBy', 'createdBy')
      .where('feature.isDeleted = false');

    if (orgId) {
      qb.andWhere('feature.organization_id = :orgId', { orgId });
    }
    if (projectId) {
      qb.andWhere('feature.project_id = :projectId', { projectId });
    }
    if (status) {
      qb.andWhere('feature.status = :status', { status });
    }
    if (priority) {
      qb.andWhere('feature.priority = :priority', { priority });
    }
    if (ownerId) {
      qb.andWhere('feature.owner_id = :ownerId', { ownerId });
    }
    if (isActive !== undefined) {
      qb.andWhere('feature.isActive = :isActive', { isActive });
    }
    if (search) {
      qb.andWhere('(feature.name ILIKE :search OR feature.description ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy(FEATURE_SORT_COLUMNS[sortBy] || FEATURE_SORT_COLUMNS.createdAt, sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<Feature> {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<Feature>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organizationId = orgId;
    }

    const feature = await this.featureRepo.findOne({
      where: whereClause,
      relations: ['project', 'owner', 'createdBy'],
    });

    if (!feature) {
      throw new NotFoundException(`Feature with ID ${id} not found`);
    }

    const safeFeature = this.sanitizeUsers(feature);
    await this.redisService.set(cacheKey, safeFeature, this.CACHE_TTL);
    return safeFeature;
  }

  async update(id: string, updateDto: UpdateFeatureDto, orgId?: string): Promise<Feature> {
    const feature = await this.findOne(id, orgId);
    const effectiveOrgId = orgId || feature.organizationId;
    const targetProjectId = updateDto.projectId || feature.projectId;

    this.validateDates(updateDto.startDate || feature.startDate, updateDto.dueDate || feature.dueDate);
    await this.ensureProject(targetProjectId, effectiveOrgId);

    if ((updateDto.name && updateDto.name !== feature.name) || targetProjectId !== feature.projectId) {
      const existing = await this.featureRepo.findOne({
        where: {
          name: updateDto.name || feature.name,
          projectId: targetProjectId,
          organizationId: effectiveOrgId,
          isDeleted: false,
        },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Feature with this name already exists in the selected project');
      }
    }

    if (updateDto.ownerId) {
      await this.ensureUser(updateDto.ownerId, effectiveOrgId);
      feature.owner = { id: updateDto.ownerId } as any;
      feature.ownerId = updateDto.ownerId;
    }

    if (updateDto.projectId) {
      feature.project = { id: updateDto.projectId } as any;
      feature.projectId = updateDto.projectId;
    }
    if (updateDto.name !== undefined) feature.name = updateDto.name;
    if (updateDto.description !== undefined) feature.description = updateDto.description;
    if (updateDto.status !== undefined) feature.status = updateDto.status;
    if (updateDto.priority !== undefined) feature.priority = updateDto.priority;
    if (updateDto.startDate !== undefined) feature.startDate = updateDto.startDate;
    if (updateDto.dueDate !== undefined) feature.dueDate = updateDto.dueDate;
    if (updateDto.budgetMinutes !== undefined) feature.budgetMinutes = updateDto.budgetMinutes;
    if (updateDto.isActive !== undefined) feature.isActive = updateDto.isActive;

    const updated = await this.featureRepo.save(feature);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeUsers(updated);
  }

  async remove(id: string, orgId?: string) {
    const feature = await this.findOne(id, orgId);
    feature.isDeleted = true;
    feature.isActive = false;

    await this.featureRepo.save(feature);
    await this.clearCache(id, orgId || feature.organizationId);
    return { message: 'Feature successfully deleted' };
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

  private sanitizeUsers(feature: Feature) {
    if (feature.createdBy && typeof feature.createdBy.toSafeObject === 'function') {
      feature.createdBy = feature.createdBy.toSafeObject();
    }
    if (feature.owner && typeof feature.owner.toSafeObject === 'function') {
      feature.owner = feature.owner.toSafeObject();
    }
    return feature;
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
