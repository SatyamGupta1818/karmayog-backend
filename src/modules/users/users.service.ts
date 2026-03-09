import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) { }

  async createUser(dto: CreateUserDto) {
    this.logger.log("Fetching the User Information")
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      this.logger.warn("Email Already Exists")
      throw new ConflictException('Email Already Exists');
    }
    const user = this.userRepo.create(dto);
    this.logger.log("User Created Successfully")
    return this.userRepo.save(user);
  }
}
