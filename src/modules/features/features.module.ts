import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedModule } from '../../shared/shared.module';
import { Project } from '../projects/entities/project.entity';
import { User } from '../users/entities/user.entity';
import { Feature } from './entities/feature.entity';
import { FeaturesController } from './features.controller';
import { FeaturesService } from './features.service';

@Module({
  imports: [TypeOrmModule.forFeature([Feature, Project, User]), SharedModule],
  controllers: [FeaturesController],
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
