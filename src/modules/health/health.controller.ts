import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { RedisService } from '../../shared/cache/redis/redis.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe — is the process up?' })
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — can we reach the DB and Redis?' })
  async readiness() {
    const [db, redis] = await Promise.all([this.checkDb(), this.redisService.ping()]);

    const healthy = db && redis;
    const body = {
      status: healthy ? 'ok' : 'error',
      services: {
        database: db ? 'up' : 'down',
        redis: redis ? 'up' : 'down',
      },
    };

    // 503 so load balancers / k8s stop routing traffic when a dependency is down.
    if (!healthy) throw new ServiceUnavailableException(body);
    return body;
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
