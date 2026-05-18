import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { winstonConfig } from './common/logger/winston.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

  app.use(helmet());

  // global prefix for all routes
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new GlobalExceptionFilter());

  // validation pipe for all incoming requests
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties that do not have any decorators
      forbidNonWhitelisted: true, // throw an error if non-whitelisted properties are present
      transform: true, // automatically transform payloads to be objects typed according to their DTO classes
    }),
  );

  // cors configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('TurfBook API Dashboard')
    .setDescription('Premium Turf Booking Application Backend Endpoints')
    .setVersion('1.0')
    .addBearerAuth() // আপনার JWT এর টোকেন টেস্ট করার জন্য সিকিউরিটি লক
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`TurfBook running on: http://localhost:${port}/api`);
}
void bootstrap();
