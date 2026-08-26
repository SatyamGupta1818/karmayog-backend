import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, ProjectListQueryDto } from './dto/projects.dto';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  @Post('create')
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project successfully created.' })
  create(@Body() createProjectDto: CreateProjectDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? (user.orgId || createProjectDto.orgId) : user.orgId;
    return this.projectsService.create(createProjectDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get a paginated list of projects' })
  findAll(
    @Query() query: ProjectListQueryDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? (user.orgId || query.orgId) : user.orgId;
    return this.projectsService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? user.orgId : user.orgId;
    return this.projectsService.findOne(id, orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a project' })
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? user.orgId : user.orgId;
    return this.projectsService.update(id, updateProjectDto, orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a project' })
  remove(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? user.orgId : user.orgId;
    return this.projectsService.remove(id, orgId);
  }
}
