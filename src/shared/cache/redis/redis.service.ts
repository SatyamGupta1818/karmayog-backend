import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly redisClient: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly config: ConfigService) {
    this.redisClient = new Redis({
      host: this.config.get<string>('REDIS_HOST', '127.0.0.1'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit() {
    this.redisClient.on('connect', () => {
      this.logger.log('🔵 Redis: Connecting...');
    });

    this.redisClient.on('ready', async () => {
      this.logger.log('✅ Redis: Connection established and ready');
      const response = await this.redisClient.ping();
      this.logger.log(`📡 Redis Ping Response: ${response}`);
    });

    this.redisClient.on('error', (err) => {
      this.logger.error('❌ Redis: Connection error', err.message);
    });
  }

  onModuleDestroy() {
    this.redisClient.quit();
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await this.redisClient.set(key, stringValue, 'EX', ttlSeconds);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);

    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch (err) {
      return data as unknown as T;
    }
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }
}