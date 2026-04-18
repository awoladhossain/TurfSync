import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// This token will be used to inject the Redis client into other services
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * This module provides a Redis client that can be injected into other services.
 * The Redis client is configured using the ConfigService, which allows you to
 * specify the Redis host and port through environment variables.
 * The client also includes a retry strategy that will attempt to reconnect if the connection is lost.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get('REDIS_HOST', 'localhost'), // Default to 'localhost' if REDIS_HOST is not set
          port: configService.get('REDIS_PORT', 6379), // Default to 6379 if REDIS_PORT is not set
          retryStrategy: (times) => Math.min(times * 50, 2000), // Retry strategy with exponential backoff
        });
      },
      inject: [ConfigService], // Inject the ConfigService to access environment variables
    },
  ],
  exports: [REDIS_CLIENT], // Export the Redis client so it can be used in other modules
})
export class RedisModule {}
