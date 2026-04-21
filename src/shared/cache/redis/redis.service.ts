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
      // Important: don't let the app hang forever if redis is down
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit() {
    this.redisClient.on('connect', () => {
      this.logger.log('🔵 Redis: Connecting...');
    });

    this.redisClient.on('ready', async () => {
      this.logger.log('✅ Redis: Connection established and ready');
      // The "Ultimate Test" - send a ping to the server
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

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redisClient.set(key, value, 'EX', ttlSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }
}