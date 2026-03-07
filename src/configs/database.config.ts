import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getDatabaseConfig = (config: ConfigService,): TypeOrmModuleOptions => {
    const db = config.get('database');
    return {
        type: 'postgres',
        host: db.host,
        port: db.port,
        username: db.username,
        password: db.password,
        database: db.name,

        autoLoadEntities: true,
        synchronize: true,
        logging: true,
    };
};