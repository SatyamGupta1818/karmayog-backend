import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateIssueDto, IssueListQueryDto, UpdateIssueDto } from './dto/issues.dto';
import { IssuesService } from './issues.service';

@ApiTags('Issues & Bugs')
@ApiBearerAuth()
@Controller('issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create an issue or bug linked to project, feature, task, or subtask' })
  @ApiResponse({ status: 201, description: 'Issue or bug successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid hierarchy, assignee, or date.' })
  create(@Body() createIssueDto: CreateIssueDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createIssueDto.orgId);
    return this.issuesService.create(createIssueDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get a paginated list of issues and bugs' })
  @ApiResponse({ status: 200, description: 'Issue list returned successfully.' })
  findAll(@Query() query: IssueListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.issuesService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an issue or bug by ID' })
  @ApiResponse({ status: 200, description: 'Issue returned successfully.' })
  @ApiResponse({ status: 404, description: 'Issue not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.issuesService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update an issue or bug' })
  @ApiResponse({ status: 200, description: 'Issue successfully updated.' })
  update(@Param('id') id: string, @Body() updateIssueDto: UpdateIssueDto, @GetCurrentUser() user: AuthenticatedUser) {
    return this.issuesService.update(id, updateIssueDto, user.orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete an issue or bug' })
  @ApiResponse({ status: 200, description: 'Issue successfully deleted.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.issuesService.remove(id, user.orgId);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
