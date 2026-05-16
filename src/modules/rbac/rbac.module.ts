import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacService } from './rbac.service';

import { Modules } from './entities/modules.rbac';
import { Permission } from './entities/permissions.rbac';
import { ModulePermission } from './entities/module-permission.rbac';
import { RolePermission } from './entities/role-permission.rbac';
import { Role } from './entities/roles.entity';
import { User } from '../users/entities/user.entity';


import { RedisModule } from 'src/shared/cache/redis/redis.module';
import { RbacController } from './rbac.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Modules,
      Permission,
      ModulePermission,
      RolePermission,
      Role,
      User,
    ]),

    RedisModule,
  ],
  providers: [RbacService],
  controllers: [RbacController],
  exports: [RbacService],
})
export class RbacModule { }