import { PartialType } from '@nestjs/swagger';
import { CreateRbacDto } from './create-rbac.dto';

export class UpdateRbacDto extends PartialType(CreateRbacDto) {}
