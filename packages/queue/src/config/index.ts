/**
 * Configuration module exports
 * Provides Redis connection configuration and queue/worker options
 */

export { getRedisConfig, getRedisConnection } from './redis';
export type { RedisConfig } from './redis';

export { defaultQueueOptions, defaultWorkerOptions } from './queue-options';
