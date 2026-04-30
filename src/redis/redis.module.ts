import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisLockService } from './redis-lock.service';
import { REDIS_CLIENT } from './redis.constants';

// This token will be used to inject the Redis client into other services

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
        const logger = new Logger('RedisClient');
        const client = new Redis({
          host: configService.get('REDIS_HOST', 'localhost'), // Default to 'localhost' if REDIS_HOST is not set
          port: configService.get('REDIS_PORT', 6379), // Default to 6379 if REDIS_PORT is not set
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            logger.warn(
              `Redis connection lost. Attempting to reconnect... (attempt ${times}, retrying in ${delay}ms)`,
            );
            return delay;
          }, // Retry strategy with exponential backoff
        });
        client.on('error', (err) => {
          logger.error(`Redis error: ${err.message}`, err.stack);
        });
        client.on('connect', () => {
          logger.log('Successfully connected to Redis');
        });
        return client;
      },
      inject: [ConfigService], // Inject the ConfigService to access environment variables
    },
    RedisLockService,
  ],
  exports: [REDIS_CLIENT, RedisLockService], // Export the Redis client and lock service so they can be used in other modules
})
export class RedisModule {}
