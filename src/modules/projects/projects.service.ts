import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { CreateProjectDto, UpdateProjectDto, ProjectListQueryDto } from './dto/projects.dto';
import { Department } from '../departments/entities/department.entity';
import { Team } from '../departments/entities/team.entity';
import { User } from '../users/entities/user.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

const PROJECT_SORT_COLUMNS = {
  name: 'project.name',
  status: 'project.status',
  startDate: 'project.startDate',
  endDate: 'project.endDate',
  isActive: 'project.isActive',
  createdAt: 'project.createdAt',
  updatedAt: 'project.updatedAt',
} as const;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'project:';
  private readonly LIST_CACHE_PREFIX = 'projects:list:';

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDto: CreateProjectDto, orgId: string, createdById: string) {
    if (!orgId) {
      throw new BadRequestException('Organization is required to create a project');
    }

    const project = this.projectRepo.create({
      name: createDto.name,
      description: createDto.description,
      status: createDto.status || ProjectStatus.PLANNING,
      startDate: createDto.startDate,
      endDate: createDto.endDate,
      organization: { id: orgId },
      createdBy: { id: createdById },
    });

    if (createDto.departmentId) {
      const department = await this.departmentRepo.findOne({
        where: { id: createDto.departmentId, organization: { id: orgId }, isDeleted: false },
      });
      if (!department) throw new NotFoundException(`Department with ID ${createDto.departmentId} not found in your organization`);
      project.department = department;
    }

    if (createDto.teamIds && createDto.teamIds.length > 0) {
      const teams = await this.teamRepo.find({
        where: { id: In(createDto.teamIds), organization: { id: orgId }, isDeleted: false },
      });
      if (teams.length !== createDto.teamIds.length) {
        throw new BadRequestException('One or more teams could not be found in your organization');
      }
      project.teams = teams;
    }

    if (createDto.memberIds && createDto.memberIds.length > 0) {
      const members = await this.userRepo.find({
        where: { id: In(createDto.memberIds), organization: { id: orgId }, isActive: true },
      });
      if (members.length !== createDto.memberIds.length) {
        throw new BadRequestException('One or more users could not be found or are inactive');
      }
      project.members = members;
    }

    const savedProject = await this.projectRepo.save(project);
    await this.clearListCache(orgId);
    return savedProject;
  }

  async findAll(query: ProjectListQueryDto, orgId?: string) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${orgId || 'all'}:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const { page = 1, limit = 10, search, status, departmentId, teamId, memberId, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const qb = this.projectRepo.createQueryBuilder('project')
      .leftJoinAndSelect('project.department', 'department')
      .leftJoinAndSelect('project.teams', 'teams')
      .leftJoinAndSelect('project.members', 'members')
      .leftJoinAndSelect('project.createdBy', 'createdBy')
      .where('project.isDeleted = false');

    if (orgId) {
      qb.andWhere('project.organization_id = :orgId', { orgId });
    }

    if (status) {
      qb.andWhere('project.status = :status', { status });
    }

    if (departmentId) {
      qb.andWhere('project.department_id = :departmentId', { departmentId });
    }

    if (teamId) {
      qb.andWhere('teams.id = :teamId', { teamId });
    }

    if (memberId) {
      qb.andWhere('members.id = :memberId', { memberId });
    }

    if (search) {
      qb.andWhere('(project.name ILIKE :search OR project.description ILIKE :search)', { search: `%${search}%` });
    }

    const sortColumn = PROJECT_SORT_COLUMNS[sortBy] || PROJECT_SORT_COLUMNS.createdAt;
    qb.orderBy(sortColumn, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Sanitize user data before returning
    const sanitizedItems = items.map(item => this.sanitizeProjectUsers(item));

    const result = {
      items: sanitizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async findOne(id: string, orgId?: string) {
    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organization = { id: orgId };
    }

    const project = await this.projectRepo.findOne({
      where: whereClause,
      relations: ['department', 'teams', 'members', 'createdBy'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const safeProject = this.sanitizeProjectUsers(project);
    await this.redisService.set(cacheKey, safeProject, this.CACHE_TTL);
    return safeProject;
  }

  async update(id: string, updateDto: UpdateProjectDto, orgId?: string) {
    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organization = { id: orgId };
    }

    const project = await this.projectRepo.findOne({
      where: whereClause,
      relations: ['teams', 'members'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const effectiveOrgId = orgId || project.organizationId;

    if (updateDto.name !== undefined) project.name = updateDto.name;
    if (updateDto.description !== undefined) project.description = updateDto.description;
    if (updateDto.status !== undefined) project.status = updateDto.status;
    if (updateDto.startDate !== undefined) project.startDate = updateDto.startDate;
    if (updateDto.endDate !== undefined) project.endDate = updateDto.endDate;
    if (updateDto.isActive !== undefined) project.isActive = updateDto.isActive;

    if (updateDto.departmentId !== undefined) {
      if (updateDto.departmentId === null) {
        project.department = null as any;
      } else {
        const department = await this.departmentRepo.findOne({
          where: { id: updateDto.departmentId, organization: { id: effectiveOrgId }, isDeleted: false },
        });
        if (!department) throw new NotFoundException(`Department with ID ${updateDto.departmentId} not found`);
        project.department = department;
      }
    }

    if (updateDto.teamIds !== undefined) {
      if (updateDto.teamIds.length > 0) {
        const teams = await this.teamRepo.find({
          where: { id: In(updateDto.teamIds), organization: { id: effectiveOrgId }, isDeleted: false },
        });
        if (teams.length !== updateDto.teamIds.length) {
          throw new BadRequestException('One or more teams could not be found');
        }
        project.teams = teams;
      } else {
        project.teams = [];
      }
    }

    if (updateDto.memberIds !== undefined) {
      if (updateDto.memberIds.length > 0) {
        const members = await this.userRepo.find({
          where: { id: In(updateDto.memberIds), organization: { id: effectiveOrgId }, isActive: true },
        });
        if (members.length !== updateDto.memberIds.length) {
          throw new BadRequestException('One or more users could not be found');
        }
        project.members = members;
      } else {
        project.members = [];
      }
    }

    const updatedProject = await this.projectRepo.save(project);
    await this.clearCache(id, effectiveOrgId);
    return this.sanitizeProjectUsers(updatedProject);
  }

  async remove(id: string, orgId?: string) {
    const whereClause: any = { id, isDeleted: false };
    if (orgId) {
      whereClause.organization = { id: orgId };
    }

    const project = await this.projectRepo.findOne({ where: whereClause });
    if (!project) throw new NotFoundException(`Project with ID ${id} not found`);

    project.isDeleted = true;
    project.isActive = false;
    await this.projectRepo.save(project);
    
    await this.clearCache(id, orgId || project.organizationId);
    return { message: 'Project successfully deleted' };
  }

  private sanitizeProjectUsers(project: Project) {
    // Strip sensitive info from relations
    if (project.createdBy && typeof project.createdBy.toSafeObject === 'function') {
      project.createdBy = project.createdBy.toSafeObject();
    }
    if (project.members && Array.isArray(project.members)) {
      project.members = project.members.map(member => 
        typeof member.toSafeObject === 'function' ? member.toSafeObject() : member
      );
    }
    return project;
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
