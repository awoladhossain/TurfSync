import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { winstonConfig } from './common/logger/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
    rawBody: true,
  });

  app.use(
    '/api/payments/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  const configService = app.get(ConfigService);

  const cookieSecret = configService.get<string>('COOKIE_SECRET');
  app.use(cookieParser(cookieSecret));
  app.use(helmet());

  // global prefix for all routes
  app.setGlobalPrefix('api');
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new PrismaExceptionFilter(),
  );

  // validation pipe for all incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties that do not have any decorators
      forbidNonWhitelisted: true, // throw an error if non-whitelisted properties are present
      transform: true, // automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // cors configuration
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  app.enableCors({
    origin: allowedOrigins ? allowedOrigins.split(',') : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Conditionally enable Swagger API Docs (Disabled in production unless explicitly enabled)
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const showSwagger =
    configService.get<string>('SHOW_SWAGGER') === 'true' || !isProduction;

  if (showSwagger) {
    const config = new DocumentBuilder()
      .setTitle('TurfBook API Dashboard')
      .setDescription('Premium Turf Booking Application Backend Endpoints')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Login to get access to protected routes',
        },
        'JWT',
      )
      .addTag('Auth', 'Registration, Login, Token management')
      .addTag('Turfs', 'Turf listing and management')
      .addTag('Bookings', 'Slot booking and cancellation')
      .addTag('Payments', 'Stripe payment integration')
      .addTag('Admin', 'Admin only endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true, // keep the token after refresh (DO NOT REMOVE)
      },
    });
  }

  const port = parseInt(configService.get<string>('PORT', '4000'), 10);
  await app.listen(port);
  new Logger('NestApplication').log(
    `TurfBook running on: http://localhost:${port}/api`,
  );
}
void bootstrap();
