import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateFeatureDto, FeatureListQueryDto, UpdateFeatureDto } from './dto/features.dto';
import { FeaturesService } from './features.service';

@ApiTags('Features')
@ApiBearerAuth()
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a feature under a project' })
  @ApiResponse({ status: 201, description: 'Feature successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid project, owner, date, or duplicate feature.' })
  create(@Body() createFeatureDto: CreateFeatureDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createFeatureDto.orgId);
    return this.featuresService.create(createFeatureDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get a paginated list of features' })
  @ApiResponse({ status: 200, description: 'Feature list returned successfully.' })
  findAll(@Query() query: FeatureListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.featuresService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a feature by ID' })
  @ApiResponse({ status: 200, description: 'Feature returned successfully.' })
  @ApiResponse({ status: 404, description: 'Feature not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.featuresService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a feature' })
  @ApiResponse({ status: 200, description: 'Feature successfully updated.' })
  update(
    @Param('id') id: string,
    @Body() updateFeatureDto: UpdateFeatureDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    return this.featuresService.update(id, updateFeatureDto, user.orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a feature' })
  @ApiResponse({ status: 200, description: 'Feature successfully deleted.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.featuresService.remove(id, user.orgId);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
