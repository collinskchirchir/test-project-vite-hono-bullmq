/**
 * @repo/queue - Notification Queue System
 * 
 * A scalable notification queuing system using BullMQ and Redis
 * for handling SMS notifications (with future support for email).
 * 
 * @example
 * ```typescript
 * import { createWelcomeSMSJob, createSMSWorker } from '@repo/queue';
 * 
 * // Queue a welcome SMS
 * await createWelcomeSMSJob({
 *   recipient: { phoneNumber: '+254712345678', name: 'John' },
 *   userName: 'John Doe'
 * });
 * 
 * // Start worker to process jobs
 * const worker = createSMSWorker();
 * ```
 */

// ============================================================================
// Job Creators - Type-safe functions for creating notification jobs
// ============================================================================

export * from './jobs';

// ============================================================================
// Types - TypeScript interfaces and types for job data and configuration
// ============================================================================

export * from './types';

// ============================================================================
// Queue Instances - BullMQ queue instances for monitoring and management
// ============================================================================

export { smsQueue, closeSMSQueue, SMS_QUEUE_NAME } from './queues';

// ============================================================================
// Worker Creators - Functions for creating and managing worker processes
// ============================================================================

export { createSMSWorker, closeSMSWorker } from './workers';

// ============================================================================
// Configuration Utilities - Redis and queue configuration helpers
// ============================================================================

export { 
  getRedisConfig, 
  getRedisConnection,
  defaultQueueOptions,
  defaultWorkerOptions 
} from './config';

export type { RedisConfig } from './config';
