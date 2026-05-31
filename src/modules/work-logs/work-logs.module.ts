import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../../shared/shared.module';
import { Issue } from '../issues/entities/issue.entity';
import { SubTask } from '../subtasks/entities/sub-task.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { WorkLog } from './entities/work-log.entity';
import { WorkLogsController } from './work-logs.controller';
import { WorkLogsService } from './work-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkLog, Task, SubTask, Issue, User]), SharedModule],
  controllers: [WorkLogsController],
  providers: [WorkLogsService],
  exports: [WorkLogsService],
})
export class WorkLogsModule {}
