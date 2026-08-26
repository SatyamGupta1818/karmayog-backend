import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
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

                    // NEVER auto-sync the schema outside local development — it can
                    // silently drop columns/data. Production uses migrations instead.
                    synchronize: nodeEnv === 'development',
                    migrations: ['dist/database/migrations/*.js'],
                    migrationsRun: nodeEnv === 'production',
                    logging: ['error'],
                };
            },
        })
    ],
})
export class DatabaseModule { }