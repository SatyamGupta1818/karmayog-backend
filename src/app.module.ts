import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';

/** Database Module */
import { DatabaseModule } from './database/database.module';

/** Shared Module (Contains Email Service) */
import { SharedModule } from './shared/shared.module';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { configuration, envValidationSchema } from './configs/env.config';
import { LoggerModule } from './common/loggers/logger.module';
import { HttpLoggerMiddleware } from './common/middlewares/http-logger.middleware';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-execptions.filters';
import { OrganizationModule } from './modules/organization/organization.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FeaturesModule } from './modules/features/features.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { SubTasksModule } from './modules/subtasks/subtasks.module';
import { IssuesModule } from './modules/issues/issues.module';
import { CommentsModule } from './modules/comments/comments.module';
import { WorkLogsModule } from './modules/work-logs/work-logs.module';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),

    // ── Rate Limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 10),
          },
        ],
      }),
    }),

    LoggerModule,
    DatabaseModule,
    SharedModule, // <-- Added SharedModule here
    AuthModule,
    UsersModule,
    OrganizationModule,
    RbacModule,
    DepartmentsModule,
    ProjectsModule,
    FeaturesModule,
    TasksModule,
    SubTasksModule,
    IssuesModule,
    CommentsModule,
    WorkLogsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, HttpLoggerMiddleware).forRoutes('*');
  }
}
