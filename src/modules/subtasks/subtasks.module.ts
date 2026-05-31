import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../../shared/shared.module';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { SubTask } from './entities/sub-task.entity';
import { SubTasksController } from './subtasks.controller';
import { SubTasksService } from './subtasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubTask, Task, User]), SharedModule],
  controllers: [SubTasksController],
  providers: [SubTasksService],
  exports: [SubTasksService],
})
export class SubTasksModule {}
