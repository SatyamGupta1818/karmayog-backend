import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CommentListQueryDto, CreateCommentDto, UpdateCommentDto } from './dto/comments.dto';
import { CommentsService } from './comments.service';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('create')
  @ApiOperation({ summary: 'Add a comment to a project, feature, task, subtask, issue, or bug' })
  @ApiResponse({ status: 201, description: 'Comment successfully created.' })
  @ApiResponse({ status: 404, description: 'Target work item not found.' })
  create(@Body() createCommentDto: CreateCommentDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, createCommentDto.orgId);
    return this.commentsService.create(createCommentDto, orgId as string, user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get comments for a work item or project' })
  @ApiResponse({ status: 200, description: 'Comment list returned successfully.' })
  findAll(@Query() query: CommentListQueryDto, @GetCurrentUser() user: AuthenticatedUser) {
    const orgId = this.resolveOrgId(user, query.orgId);
    return this.commentsService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({ status: 200, description: 'Comment returned successfully.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  findOne(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.commentsService.findOne(id, user.orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a comment' })
  @ApiResponse({ status: 200, description: 'Comment successfully updated.' })
  @ApiResponse({ status: 403, description: 'Only author or moderator can update.' })
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    return this.commentsService.update(id, updateCommentDto, user.orgId, user);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Soft delete a comment' })
  @ApiResponse({ status: 200, description: 'Comment successfully deleted.' })
  @ApiResponse({ status: 403, description: 'Only author or moderator can delete.' })
  remove(@Param('id') id: string, @GetCurrentUser() user: AuthenticatedUser) {
    return this.commentsService.remove(id, user.orgId, user);
  }

  private resolveOrgId(user: AuthenticatedUser, requestedOrgId?: string) {
    return user.roles.includes('SUPER_ADMIN') ? user.orgId || requestedOrgId : user.orgId;
  }
}
