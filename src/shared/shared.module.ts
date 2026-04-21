import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { EmailService } from './services/email.service';
import { RedisService } from './cache/redis/redis.service';

@Global()
@Module({
    imports: [
        MailerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                transport: {
                    host: config.get<string>('MAIL_HOST', 'smtp.gmail.com'),
                    port: config.get<number>('MAIL_PORT', 587),
                    secure: false,
                    auth: {
                        user: config.get<string>('MAIL_USER'),
                        pass: config.get<string>('MAIL_PASSWORD'),
                    },
                },
                defaults: {
                    from: `"Karmayog Support" <${config.get<string>('MAIL_USER')}>`,
                },
                template: {
                    dir: join(__dirname, 'templates'), // Ensure this path is still correct
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
        }),
    ],
    providers: [EmailService, RedisService],
    exports: [EmailService, RedisService],
})
export class SharedModule {
    constructor(private readonly redisService: RedisService) { }
}