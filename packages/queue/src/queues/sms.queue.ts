import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { defaultQueueOptions } from '../config/queue-options';
import type { SMSJobData } from '../types';

/**
 * SMS Queue name constant
 */
export const SMS_QUEUE_NAME = 'sms-notifications';

/**
 * SMS Queue instance for managing SMS notification jobs
 */
export const smsQueue = new Queue<SMSJobData>(SMS_QUEUE_NAME, {
  connection: getRedisConnection(),
  ...defaultQueueOptions,
});

/**
 * Gracefully close the SMS queue connection
 * Should be called during application shutdown
 */
export const closeSMSQueue = async (): Promise<void> => {
  await smsQueue.close();
};
