import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './dto/tasks.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a task under a feature' })
  @ApiResponse({ status: 201, description: 'Task successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid feature, assignee, date, or duplicate task.' })
  create(@Body() createTaskDto: CreateTaskDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createTaskDto.orgId);
    return this.tasksService.create(createTaskDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get a paginated list of tasks' })
  @ApiResponse({ status: 200, description: 'Task list returned successfully.' })
  findAll(@Query() query: TaskListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.tasksService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiResponse({ status: 200, description: 'Task returned successfully.' })
  @ApiResponse({ status: 404, description: 'Task not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.tasksService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task successfully updated.' })
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @GetCurrentUser() user: AuthenticatedUser) {
    return this.tasksService.update(id, updateTaskDto, user.orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a task' })
  @ApiResponse({ status: 200, description: 'Task successfully deleted.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.tasksService.remove(id, user.orgId);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
