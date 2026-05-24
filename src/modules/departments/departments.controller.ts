import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, DepartmentListQueryDto } from './dto/department.dto';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('department')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) { }

  @Post('create')
  create(
    @Body() createDepartmentDto: CreateDepartmentDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? createDepartmentDto.orgId : user.orgId;
    return this.departmentsService.create(createDepartmentDto, orgId);
  }

  @Get('list')
  findAll(
    @Query() query: DepartmentListQueryDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.orgId;
    return this.departmentsService.findAll(query, orgId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.departmentsService.findOne(id, orgId);
  }

  @Patch('update/:id')
  update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.departmentsService.update(id, updateDepartmentDto, orgId);
  }

  @Delete('delete/:id')
  remove(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.departmentsService.remove(id, orgId);
  }
}
