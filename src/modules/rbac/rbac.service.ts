import { Injectable } from '@nestjs/common';
import { CreateRbacDto } from './dto/create-rbac.dto';
import { UpdateRbacDto } from './dto/update-rbac.dto';

@Injectable()
export class RbacService {
  create(createRbacDto: CreateRbacDto) {
    return 'This action adds a new rbac';
  }

  findAll() {
    return `This action returns all rbac`;
  }

  findOne(id: number) {
    return `This action returns a #${id} rbac`;
  }

  update(id: number, updateRbacDto: UpdateRbacDto) {
    return `This action updates a #${id} rbac`;
  }

  remove(id: number) {
    return `This action removes a #${id} rbac`;
  }
}
