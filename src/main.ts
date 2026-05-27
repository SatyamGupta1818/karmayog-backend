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

const compression = require('compression');
const helmet = require('helmet');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const port = config.get<number>('server.port', 3000);

  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );

  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  app.use(compression());

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  const jwtGuard = new JwtAuthGuard();
  const apiKeyGuard = new ApiKeyGuard(config);
  app.useGlobalGuards(new CompositeAuthGuard(reflector, jwtGuard, apiKeyGuard));

  // ✅ ADD THIS BLOCK (root health check)
  const server = app.getHttpAdapter().getInstance();
  server.get('/', (req, res) => {
    res.status(200).json({
      status: 'OK',
      message: 'Server is running',
    });
  });

  // Swagger
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
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Environment  : ${nodeEnv}`);
  logger.log(`Server       : http://localhost:${port}/api/v1`);
  if (nodeEnv !== 'production') {
    logger.log(`Swagger docs : http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});