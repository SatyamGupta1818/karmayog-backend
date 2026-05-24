import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTeamDto, UpdateTeamDto, TeamListQueryDto } from './dto/teams.dto';
import { Team } from './entities/team.entity';
import { Department } from './entities/department.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

@Injectable()
export class TeamsService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'team:';
  private readonly LIST_CACHE_PREFIX = 'teams:list:';

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly redisService: RedisService,
  ) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    const department = await this.departmentRepository.findOne({ where: { id: createTeamDto.departmentId, isDeleted: false } });
    if (!department) {
      throw new NotFoundException(`Department with ID "${createTeamDto.departmentId}" not found`);
    }

    const existing = await this.teamRepository.findOne({ 
      where: { name: createTeamDto.name, departmentId: createTeamDto.departmentId, isDeleted: false } 
    });
    
    if (existing) {
      throw new BadRequestException('Team with this name already exists in the selected department');
    }

    const team = this.teamRepository.create(createTeamDto);
    const saved = await this.teamRepository.save(team);
    
    await this.clearCache();
    return saved;
  }

  async findAll(query: TeamListQueryDto) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const { page = 1, limit = 10, search, departmentId, isActive, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const qb = this.teamRepository.createQueryBuilder('team')
      .leftJoinAndSelect('team.department', 'department');

    qb.where('team.isDeleted = :isDeleted', { isDeleted: false });

    if (departmentId) {
      qb.andWhere('team.departmentId = :departmentId', { departmentId });
    }

    if (search) {
      qb.andWhere('(team.name ILIKE :search OR team.description ILIKE :search)', { search: `%${search}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('team.isActive = :isActive', { isActive });
    }

    qb.orderBy(`team.${sortBy}`, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    
    const result = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    
    return result;
  }

  async findOne(id: string): Promise<Team> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cachedData = await this.redisService.get<Team>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const team = await this.teamRepository.findOne({ 
      where: { id, isDeleted: false },
      relations: ['department']
    });
    
    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }

    await this.redisService.set(cacheKey, team, this.CACHE_TTL);
    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto): Promise<Team> {
    const team = await this.findOne(id);

    if (updateTeamDto.departmentId && updateTeamDto.departmentId !== team.departmentId) {
      const department = await this.departmentRepository.findOne({ where: { id: updateTeamDto.departmentId, isDeleted: false } });
      if (!department) {
        throw new NotFoundException(`Department with ID "${updateTeamDto.departmentId}" not found`);
      }
    }

    if (updateTeamDto.name) {
      const targetDepartmentId = updateTeamDto.departmentId || team.departmentId;
      const existing = await this.teamRepository.findOne({ 
        where: { name: updateTeamDto.name, departmentId: targetDepartmentId, isDeleted: false } 
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Team with this name already exists in the selected department');
      }
    }

    Object.assign(team, updateTeamDto);
    const updated = await this.teamRepository.save(team);

    await this.clearCache(id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOne(id);
    team.isDeleted = true;
    team.isActive = false;
    
    await this.teamRepository.save(team);
    await this.clearCache(id);
  }

  private async clearCache(id?: string) {
    if (id) {
      await this.redisService.del(`${this.CACHE_PREFIX}${id}`);
    }
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}*`);
  }
}
