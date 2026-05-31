import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateSubTaskDto, SubTaskListQueryDto, UpdateSubTaskDto } from './dto/subtasks.dto';
import { SubTasksService } from './subtasks.service';

@ApiTags('SubTasks')
@ApiBearerAuth()
@Controller('subtasks')
export class SubTasksController {
  constructor(private readonly subTasksService: SubTasksService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a subtask under a task' })
  @ApiResponse({ status: 201, description: 'Subtask successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid task, assignee, date, or duplicate subtask.' })
  create(@Body() createSubTaskDto: CreateSubTaskDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createSubTaskDto.orgId);
    return this.subTasksService.create(createSubTaskDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get a paginated list of subtasks' })
  @ApiResponse({ status: 200, description: 'Subtask list returned successfully.' })
  findAll(@Query() query: SubTaskListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.subTasksService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subtask by ID' })
  @ApiResponse({ status: 200, description: 'Subtask returned successfully.' })
  @ApiResponse({ status: 404, description: 'Subtask not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.subTasksService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a subtask' })
  @ApiResponse({ status: 200, description: 'Subtask successfully updated.' })
  update(
    @Param('id') id: string,
    @Body() updateSubTaskDto: UpdateSubTaskDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    return this.subTasksService.update(id, updateSubTaskDto, user.orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a subtask' })
  @ApiResponse({ status: 200, description: 'Subtask successfully deleted.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.subTasksService.remove(id, user.orgId);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
