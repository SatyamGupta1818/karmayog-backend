import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentListQueryDto } from './dto/department.dto';
import { Department } from './entities/department.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

@Injectable()
export class DepartmentsService {
  private readonly CACHE_TTL = 3600; 
  private readonly CACHE_PREFIX = 'department:';
  private readonly LIST_CACHE_PREFIX = 'departments:list:';

  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    private readonly redisService: RedisService,
  ) {}

  async create(createDepartmentDto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.departmentRepository.findOne({ where: { name: createDepartmentDto.name } });
    if (existing) {
      throw new BadRequestException('Department with this name already exists');
    }

    const department = this.departmentRepository.create(createDepartmentDto);
    const saved = await this.departmentRepository.save(department);
    
    await this.clearCache();
    return saved;
  }

  async findAll(query: DepartmentListQueryDto) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const { page = 1, limit = 10, search, isActive, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const qb = this.departmentRepository.createQueryBuilder('department');

    qb.where('department.isDeleted = :isDeleted', { isDeleted: false });

    if (search) {
      qb.andWhere('department.name ILIKE :search OR department.description ILIKE :search', { search: `%${search}%` });
    }

    if (isActive !== undefined) {
      qb.andWhere('department.isActive = :isActive', { isActive });
    }

    qb.orderBy(`department.${sortBy}`, sortOrder);
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

  async findOne(id: string): Promise<Department> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cachedData = await this.redisService.get<Department>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const department = await this.departmentRepository.findOne({ where: { id, isDeleted: false } });
    
    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    await this.redisService.set(cacheKey, department, this.CACHE_TTL);
    return department;
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto): Promise<Department> {
    const department = await this.findOne(id);

    if (updateDepartmentDto.name && updateDepartmentDto.name !== department.name) {
      const existing = await this.departmentRepository.findOne({ where: { name: updateDepartmentDto.name } });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Department with this name already exists');
      }
    }

    Object.assign(department, updateDepartmentDto);
    const updated = await this.departmentRepository.save(department);

    await this.clearCache(id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const department = await this.findOne(id);
    department.isDeleted = true;
    department.isActive = false;
    
    await this.departmentRepository.save(department);
    await this.clearCache(id);
  }

  private async clearCache(id?: string) {
    if (id) {
      await this.redisService.del(`${this.CACHE_PREFIX}${id}`);
    }
    // Delete all list caches
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}*`);
  }
}
