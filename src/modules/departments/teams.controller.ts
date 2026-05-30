import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, TeamListQueryDto } from './dto/teams.dto';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('create')
  create(
    @Body() createTeamDto: CreateTeamDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? (user.orgId || createTeamDto.orgId) : user.orgId;
    return this.teamsService.create(createTeamDto, orgId);
  }

  @Get('list')
  findAll(
    @Query() query: TeamListQueryDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.orgId;
    return this.teamsService.findAll(query, orgId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.orgId;
    return this.teamsService.findOne(id, orgId);
  }

  @Patch('update/:id')
  update(
    @Param('id') id: string, 
    @Body() updateTeamDto: UpdateTeamDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.orgId;
    return this.teamsService.update(id, updateTeamDto, orgId);
  }

  @Delete('delete/:id')
  remove(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.orgId;
    return this.teamsService.remove(id, orgId);
  }
}
