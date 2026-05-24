import { ConflictException, Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './dto/users.dto';
import { Department } from '../departments/entities/department.entity';
import { Team } from '../departments/entities/team.entity';
import { Role } from '../rbac/entities/roles.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'user:';
  private readonly LIST_CACHE_PREFIX = 'users:list:';

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly redisService: RedisService,
  ) {}

  async createUser(dto: CreateUserDto) {
    this.logger.log('Fetching the User Information');
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      this.logger.warn('Email Already Exists');
      throw new ConflictException('Email Already Exists');
    }

    const user = this.userRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: dto.password,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    if (dto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException(`Role with ID ${dto.roleId} not found`);
      user.role = role;
    }

    if (dto.departmentId) {
      const department = await this.departmentRepo.findOne({ where: { id: dto.departmentId } });
      if (!department) throw new NotFoundException(`Department with ID ${dto.departmentId} not found`);
      user.department = department;
    }

    if (dto.teamIds && dto.teamIds.length > 0) {
      const teams = await this.teamRepo.findBy({ id: In(dto.teamIds) });
      if (teams.length !== dto.teamIds.length) {
        throw new BadRequestException('One or more teams could not be found');
      }
      // Ensure all teams belong to the provided department if departmentId is passed
      if (dto.departmentId) {
        const invalidTeams = teams.filter(t => t.departmentId !== dto.departmentId);
        if (invalidTeams.length > 0) {
          throw new BadRequestException('Some teams do not belong to the selected department');
        }
      }
      user.teams = teams;
    }

    this.logger.log('User Created Successfully');
    const savedUser = await this.userRepo.save(user);
    
    await this.clearListCache();
    return savedUser.toSafeObject();
  }

  async findAll(query: UserListQueryDto) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const { page = 1, limit = 10, search, departmentId, teamId, roleId, isActive, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const skip = (page - 1) * limit;

    const qb = this.userRepo.createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.department', 'department')
      .leftJoinAndSelect('user.teams', 'teams')
      .where('user.isActive != false'); // Assuming you want active users by default or we can just filter by isActive explicitly

    if (isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive });
    }

    if (search) {
      qb.andWhere('(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)', { search: `%${search}%` });
    }

    if (departmentId) {
      qb.andWhere('user.department_id = :departmentId', { departmentId });
    }

    if (roleId) {
      qb.andWhere('user.role_id = :roleId', { roleId });
    }

    if (teamId) {
      qb.andWhere('teams.id = :teamId', { teamId });
    }

    qb.orderBy(`user.${sortBy}`, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    
    const result = {
      items: items.map(item => item.toSafeObject()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.redisService.set(cacheKey, result, this.CACHE_TTL);
    
    return result;
  }

  async findOne(id: string) {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'department', 'teams']
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const safeUser = user.toSafeObject();
    await this.redisService.set(cacheKey, safeUser, this.CACHE_TTL);
    return safeUser;
  }

  async update(id: string, updateDto: UpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id }, relations: ['teams'] });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (updateDto.email && updateDto.email !== user.email) {
      const existingUser = await this.userRepo.findOne({ where: { email: updateDto.email } });
      if (existingUser) throw new ConflictException('Email Already Exists');
      user.email = updateDto.email;
    }

    if (updateDto.firstName) user.firstName = updateDto.firstName;
    if (updateDto.lastName) user.lastName = updateDto.lastName;
    if (updateDto.password) user.password = updateDto.password; // Assuming hashing happens via a subscriber or we should hash here if needed
    if (updateDto.isActive !== undefined) user.isActive = updateDto.isActive;

    if (updateDto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: updateDto.roleId } });
      if (!role) throw new NotFoundException(`Role with ID ${updateDto.roleId} not found`);
      user.role = role;
    }

    if (updateDto.departmentId) {
      const department = await this.departmentRepo.findOne({ where: { id: updateDto.departmentId } });
      if (!department) throw new NotFoundException(`Department with ID ${updateDto.departmentId} not found`);
      user.department = department;
    } else if (updateDto.departmentId === null) {
        user.department = null as any;
    }

    if (updateDto.teamIds !== undefined) {
      if (updateDto.teamIds.length > 0) {
        const teams = await this.teamRepo.findBy({ id: In(updateDto.teamIds) });
        if (teams.length !== updateDto.teamIds.length) {
          throw new BadRequestException('One or more teams could not be found');
        }
        user.teams = teams;
      } else {
        user.teams = [];
      }
    }

    const updatedUser = await this.userRepo.save(user);
    await this.clearCache(id);
    return updatedUser.toSafeObject();
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    user.isActive = false; // Soft delete
    await this.userRepo.save(user);
    await this.clearCache(id);
  }

  private async clearCache(id: string) {
    await this.redisService.del(`${this.CACHE_PREFIX}${id}`);
    await this.clearListCache();
  }

  private async clearListCache() {
    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}*`);
  }
}
