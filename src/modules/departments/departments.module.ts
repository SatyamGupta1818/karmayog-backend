import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { Department } from './entities/department.entity';
import { Team } from './entities/team.entity';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, Team]),
    SharedModule,
  ],
  controllers: [DepartmentsController, TeamsController],
  providers: [DepartmentsService, TeamsService],
  exports: [DepartmentsService, TeamsService],
})
export class DepartmentsModule {}
