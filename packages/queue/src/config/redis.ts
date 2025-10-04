import type { ConnectionOptions } from 'bullmq';

/**
 * Redis configuration interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: number | null;
}

/**
 * Get Redis configuration from environment variables
 * @returns RedisConfig object with connection details
 * @throws Error if required configuration is missing in production
 */
export const getRedisConfig = (): RedisConfig => {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;
  const db = parseInt(process.env.REDIS_DB || '0', 10);

  // Validate required configuration in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REDIS_HOST) {
      throw new Error('REDIS_HOST environment variable is required in production');
    }
    if (!process.env.REDIS_PASSWORD) {
      console.warn('REDIS_PASSWORD is not set. This is not recommended for production.');
    }
  }

  // Validate port number
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid REDIS_PORT: ${process.env.REDIS_PORT}. Must be between 1 and 65535.`);
  }

  // Validate db number
  if (isNaN(db) || db < 0) {
    throw new Error(`Invalid REDIS_DB: ${process.env.REDIS_DB}. Must be a non-negative integer.`);
  }

  return {
    host,
    port,
    password,
    db,
    maxRetriesPerRequest: null, // Required for BullMQ
  };
};

/**
 * Get Redis connection options for BullMQ
 * @returns ConnectionOptions compatible with BullMQ
 */
export const getRedisConnection = (): ConnectionOptions => {
  return {
    ...getRedisConfig(),
  };
};
