import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import {
  CreateOrganizationDto,
  OrganizationListQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Organization')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post(['', 'create'])
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
  })
  @ApiResponse({ status: 409, description: 'Organization already exists' })
  create(@Body() createOrganizationDto: CreateOrganizationDto) {
    return this.organizationService.create(createOrganizationDto);
  }

  @Get(['', 'list'])
  @ApiOperation({ summary: 'Get list of organizations' })
  findAll(
    @Query() query: OrganizationListQueryDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = this.resolveOrganizationScope(user);
    return this.organizationService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = this.resolveOrganizationScope(user);
    return this.organizationService.findOne(id, orgId);
  }

  @Patch([':id', 'update/:id'])
  @ApiOperation({ summary: 'Update an organization' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = this.resolveOrganizationScope(user);
    return this.organizationService.update(id, updateOrganizationDto, orgId);
  }

  @Delete([':id', 'delete/:id'])
  @ApiOperation({ summary: 'Delete an organization' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = this.resolveOrganizationScope(user);
    return this.organizationService.remove(id, orgId);
  }

  private resolveOrganizationScope(user?: AuthenticatedUser) {
    return user?.roles?.includes('SUPER_ADMIN') ? undefined : user?.orgId;
  }
}
