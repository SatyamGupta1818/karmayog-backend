import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserListQueryDto } from './dto/users.dto';
import { GetCurrentUser } from '../../common/decorators/get-current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Users')
@Controller('user')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(
    @Body() createUserDto: CreateUserDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? createUserDto.orgId : user.orgId;
    return this.usersService.createUser(createUserDto, orgId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Get list of users' })
  findAll(
    @Query() query: UserListQueryDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = user.orgId;
    return this.usersService.findAll(query, orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  findOne(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.usersService.findOne(id, orgId);
  }

  @Patch('update/:id')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.usersService.update(id, updateUserDto, orgId);
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete a user' })
  remove(
    @Param('id') id: string,
    @GetCurrentUser() user: AuthenticatedUser,
  ) {
    const orgId = user.roles.includes('SUPER_ADMIN') ? undefined : user.orgId;
    return this.usersService.remove(id, orgId);
  }
}
