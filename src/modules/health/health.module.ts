import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// RedisService is provided globally by SharedModule; DataSource by TypeOrmModule.
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
