import type { QueueOptions, WorkerOptions } from 'bullmq';

/**
 * Default queue options with retry policies and job retention
 * Note: Connection must be provided when creating a queue
 */
export const defaultQueueOptions: Partial<QueueOptions> = {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000, // Start with 2 seconds, then 4s, 8s
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
    },
};

/**
 * Default worker options with concurrency and rate limiting
 */
export const defaultWorkerOptions: Partial<WorkerOptions> = {
    concurrency: 5, // Process 5 jobs concurrently per worker
    limiter: {
        max: 10, // Max 10 jobs
        duration: 1000, // Per second (1000ms)
    },
};
