import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { winstonConfig } from './common/logger/winston.config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });

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
  app.enableCors();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`TurfBook running on: http://localhost:${port}/api`);
}
void bootstrap();
