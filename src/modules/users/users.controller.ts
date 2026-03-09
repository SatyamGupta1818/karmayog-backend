import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiSecurity, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { RequireApiKey } from 'src/common/decorators/api-key.decorator';

@ApiTags('Users')
@Controller('users') // → /api/users
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Public()
  @Post('create')
  @ApiOperation({ summary: 'Create a new user (requires x-api-key header)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'API key is required' })
  @ApiResponse({ status: 403, description: 'Invalid API key' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }
}