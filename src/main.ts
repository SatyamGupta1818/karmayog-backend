import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/loggers/winston.config';
import {
  Logger,
  ValidationPipe,
  ClassSerializerInterceptor,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-execptions.filters';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CompositeAuthGuard } from './common/guards/auth.guard';

// CommonJS packages that don't have proper ESM exports
const compression = require('compression');
const helmet = require('helmet');

async function bootstrap() {
  // ── App Instance ────────────────────────────────────────────────────────────
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    bufferLogs: true,
  });

  // ── Config & Reflector (resolved from DI, not manually newed) ──────────────
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const port = config.get<number>('server.port', 3000);

  // ── Security Middleware ─────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',  // Enable CSP only in prod
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  // ── Compression ─────────────────────────────────────────────────────────────
  app.use(compression());

  // ── Global Prefix & Versioning ──────────────────────────────────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // Routes will be: /api/v1/auth/login, /api/v1/users, etc.

  // ── Global Validation Pipe ──────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip unknown/undecorated fields
      forbidNonWhitelisted: true,   // Throw 400 on unknown fields instead of silently stripping
      transform: true,              // Auto-transform payloads to DTO class instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Global Exception Filter ─────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global Interceptors ─────────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    // Respects @Exclude() and @Expose() on entity/DTO classes
    new ClassSerializerInterceptor(reflector),
  );

  // ── Global Guards ───────────────────────────────────────────────────────────
  // Fix: ApiKeyGuard and JwtAuthGuard resolved via app.get() where possible,
  // but JwtAuthGuard here is manually instantiated since it uses Passport internally.
  // CompositeAuthGuard wires them together and respects @Public() decorator.
  const jwtGuard = new JwtAuthGuard();
  const apiKeyGuard = new ApiKeyGuard(config);
  app.useGlobalGuards(new CompositeAuthGuard(reflector, jwtGuard, apiKeyGuard));

  // ── Swagger (non-production only) ───────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('HealthCare API')
      .setDescription('HealthCare Backend REST API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'access-token',
      )
      .addApiKey(
        {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Enter your API key',
        },
        'api-key',
      )
      .addTag('Auth', 'Authentication & token management')
      .addTag('Users', 'User management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,   // Keeps token across page refreshes
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // ── Start Server ────────────────────────────────────────────────────────────
  await app.listen(port);

  // Use NestJS Logger (routed through Winston) rather than console.log
  const logger = new Logger('Bootstrap');
  logger.log(`Environment  : ${nodeEnv}`);
  logger.log(`Server       : http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger docs : http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  // Catch bootstrap-level errors (DB connection failure, bad env vars, etc.)
  // before the Logger is available
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});