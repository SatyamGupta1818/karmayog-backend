import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateOrganizationDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { Organization } from './entities/organization.entity';
import { RedisService } from '../../shared/cache/redis/redis.service';

const ORGANIZATION_SORT_COLUMNS = {
  organizationName: 'organization.organizationName',
  organizationType: 'organization.organizationType',
  organizationSize: 'organization.organizationSize',
  orgEmail: 'organization.orgEmail',
  subscriptionType: 'organization.subscriptionType',
  isSubscriptionTaken: 'organization.isSubscriptionTaken',
  isActive: 'organization.isActive',
  createdAt: 'organization.createdAt',
  updatedAt: 'organization.updatedAt',
} as const;

@Injectable()
export class OrganizationService {
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'organization:';
  private readonly LIST_CACHE_PREFIX = 'organizations:list:';

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly redisService: RedisService,
  ) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    await this.ensureOrganizationIsUnique(createOrganizationDto);

    const organization = this.organizationRepository.create({
      organizationName: createOrganizationDto.organizationName,
      organizationType: createOrganizationDto.organizationType,
      organizationSize: createOrganizationDto.organizationSize,
      orgEmail: createOrganizationDto.orgEmail,
      website: createOrganizationDto.website,
      subscriptionType: createOrganizationDto.subscriptionType,
      isSubscriptionTaken: createOrganizationDto.isSubscriptionTaken ?? false,
      isActive: createOrganizationDto.isActive ?? true,
    });

    const savedOrganization =
      await this.organizationRepository.save(organization);
    await this.clearCache();

    return savedOrganization;
  }

  async findAll(query: OrganizationListQueryDto, orgId?: string) {
    const cacheKey = `${this.LIST_CACHE_PREFIX}${orgId || 'all'}:${JSON.stringify(query)}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const {
      page = 1,
      limit = 10,
      search,
      subscriptionType,
      isSubscriptionTaken,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.organizationRepository
      .createQueryBuilder('organization')
      .leftJoinAndSelect('organization.owner', 'owner')
      .where('organization.is_deleted = :isDeleted', { isDeleted: false });

    if (orgId) {
      qb.andWhere('organization.id = :orgId', { orgId });
    }

    if (search) {
      qb.andWhere(
        `(
          organization.organization_name ILIKE :search OR
          organization.organization_type ILIKE :search OR
          organization.organization_size ILIKE :search OR
          organization.org_email ILIKE :search OR
          organization.website ILIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    if (subscriptionType) {
      qb.andWhere('organization.subscription_type = :subscriptionType', {
        subscriptionType,
      });
    }

    if (isSubscriptionTaken !== undefined) {
      qb.andWhere('organization.is_subscription_taken = :isSubscriptionTaken', {
        isSubscriptionTaken,
      });
    }

    if (isActive !== undefined) {
      qb.andWhere('organization.is_active = :isActive', { isActive });
    }

    qb.orderBy(ORGANIZATION_SORT_COLUMNS[sortBy], sortOrder);
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

  async findOne(id: string, orgId?: string): Promise<Organization> {
    if (orgId && id !== orgId) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    const cacheKey = this.getCacheKey(id, orgId);
    const cachedData = await this.redisService.get<Organization>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const organization = await this.organizationRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['users', 'owner'],
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }

    await this.redisService.set(cacheKey, organization, this.CACHE_TTL);

    return organization;
  }

  async update(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    orgId?: string,
  ): Promise<Organization> {
    if (Object.keys(updateOrganizationDto).length === 0) {
      throw new BadRequestException(
        'At least one field is required to update an organization',
      );
    }

    const organization = await this.findOne(id, orgId);
    await this.ensureOrganizationIsUnique(updateOrganizationDto, id);

    Object.assign(organization, updateOrganizationDto);

    const updatedOrganization =
      await this.organizationRepository.save(organization);
    await this.clearCache(id);

    return updatedOrganization;
  }

  async remove(id: string, orgId?: string): Promise<void> {
    const organization = await this.findOne(id, orgId);

    organization.isDeleted = true;
    organization.isActive = false;
    organization.deletedAt = new Date();

    await this.organizationRepository.save(organization);
    await this.clearCache(id);
  }

  private async ensureOrganizationIsUnique(
    dto: Partial<CreateOrganizationDto>,
    currentOrganizationId?: string,
  ) {
    if (dto.organizationName) {
      const existingName = await this.organizationRepository
        .createQueryBuilder('organization')
        .where(
          'LOWER(organization.organization_name) = LOWER(:organizationName)',
          {
            organizationName: dto.organizationName,
          },
        )
        .andWhere('organization.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere(
          currentOrganizationId
            ? 'organization.id != :currentOrganizationId'
            : '1 = 1',
          { currentOrganizationId },
        )
        .getOne();

      if (existingName) {
        throw new ConflictException(
          'Organization with this name already exists',
        );
      }
    }

    if (dto.orgEmail) {
      const existingEmail = await this.organizationRepository
        .createQueryBuilder('organization')
        .where('LOWER(organization.org_email) = LOWER(:orgEmail)', {
          orgEmail: dto.orgEmail,
        })
        .andWhere('organization.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere(
          currentOrganizationId
            ? 'organization.id != :currentOrganizationId'
            : '1 = 1',
          { currentOrganizationId },
        )
        .getOne();

      if (existingEmail) {
        throw new ConflictException(
          'Organization with this email already exists',
        );
      }
    }
  }

  private async clearCache(id?: string) {
    if (id) {
      await this.redisService.del(`${this.CACHE_PREFIX}${id}`);
      await this.redisService.delByPattern(`${this.CACHE_PREFIX}*:${id}`);
    }

    await this.redisService.delByPattern(`${this.LIST_CACHE_PREFIX}*`);
  }

  private getCacheKey(id: string, orgId?: string) {
    return `${this.CACHE_PREFIX}${orgId || 'all'}:${id}`;
  }
}
