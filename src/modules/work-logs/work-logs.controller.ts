import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateWorkLogDto, UpdateWorkLogDto, WorkLogListQueryDto, WorkLogReportQueryDto } from './dto/work-logs.dto';
import { WorkLogsService } from './work-logs.service';

@ApiTags('Work Logs')
@ApiBearerAuth()
@Controller('work-logs')
export class WorkLogsController {
  constructor(private readonly workLogsService: WorkLogsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Add time spent to a task, subtask, issue, or bug' })
  @ApiResponse({ status: 201, description: 'Work log successfully created.' })
  @ApiResponse({ status: 404, description: 'Target work item not found.' })
  create(@Body() createWorkLogDto: CreateWorkLogDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createWorkLogDto.orgId);
    return this.workLogsService.create(createWorkLogDto, orgId as string, user);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get paginated work logs' })
  @ApiResponse({ status: 200, description: 'Work log list returned successfully.' })
  findAll(@Query() query: WorkLogListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.workLogsService.findAll(query, orgId);
  }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily work log hours' })
  @ApiResponse({ status: 200, description: 'Daily work log report returned successfully.' })
  getDaily(@Query() query: WorkLogReportQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.workLogsService.getDailyReport(query, orgId);
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get weekly work log hours' })
  @ApiResponse({ status: 200, description: 'Weekly work log report returned successfully.' })
  getWeekly(@Query() query: WorkLogReportQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.workLogsService.getWeeklyReport(query, orgId);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly work log hours' })
  @ApiResponse({ status: 200, description: 'Monthly work log report returned successfully.' })
  getMonthly(@Query() query: WorkLogReportQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.workLogsService.getMonthlyReport(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a work log by ID' })
  @ApiResponse({ status: 200, description: 'Work log returned successfully.' })
  @ApiResponse({ status: 404, description: 'Work log not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.workLogsService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a work log' })
  @ApiResponse({ status: 200, description: 'Work log successfully updated.' })
  update(
    @Param('id') id: string,
    @Body() updateWorkLogDto: UpdateWorkLogDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    return this.workLogsService.update(id, updateWorkLogDto, user.orgId, user);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a work log' })
  @ApiResponse({ status: 200, description: 'Work log successfully deleted.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.workLogsService.remove(id, user.orgId, user);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
