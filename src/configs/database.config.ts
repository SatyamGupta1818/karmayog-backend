import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (config: ConfigService,): TypeOrmModuleOptions => {
    const db = config.get('database');
    const nodeEnv = config.get<string>('NODE_ENV', 'development');
    return {
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.name,

        autoLoadEntities: true,
        // Auto-sync only in local dev; production relies on migrations.
        synchronize: nodeEnv === 'development',
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: nodeEnv === 'production',
        logging: false,
    };
};