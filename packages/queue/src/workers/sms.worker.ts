import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { defaultWorkerOptions } from '../config/queue-options';
import { SMS_QUEUE_NAME } from '../queues/sms.queue';
import type { SMSJobData } from '../types';
import { renderWelcomeSMS } from '../templates/sms/welcome';
import { renderOTPSMS } from '../templates/sms/otp';
import { renderNotificationSMS } from '../templates/sms/notification';
import { createSMSProvider } from '../providers/sms/factory';
import type { SMSProvider } from '../providers/sms/interface';

// Initialize SMS provider based on environment
const smsProvider: SMSProvider = createSMSProvider();

/**
 * Process SMS jobs by routing to appropriate template and sending via provider
 * @param job - BullMQ job containing SMS job data
 * @returns Result object with success status and metadata
 */
const processSMSJob = async (job: Job<SMSJobData>) => {
    console.log(`Processing SMS job ${job.id} of type ${job.data.type}`);

    let templateResult;

    // Route to appropriate template based on job type
    switch (job.data.type) {
        case 'welcome':
            templateResult = renderWelcomeSMS(job.data);
            break;
        case 'otp':
            templateResult = renderOTPSMS(job.data);
            break;
        case 'notification':
            templateResult = renderNotificationSMS(job.data);
            break;
        default:
            throw new Error(`Unknown SMS job type: ${(job.data as any).type}`);
    }

    // Send SMS via provider
    const result = await smsProvider.send(
        templateResult.recipient.phoneNumber,
        templateResult.message
    );

    if (!result.success) {
        throw new Error(`SMS send failed: ${result.error}`);
    }

    console.log(
        `Successfully sent SMS job ${job.id} via ${result.provider}, messageId: ${result.messageId}`
    );

    return {
        success: true,
        jobId: job.id,
        messageId: result.messageId,
        provider: result.provider,
    };
};

/**
 * Create and configure an SMS worker instance
 * @returns Configured BullMQ Worker instance for processing SMS jobs
 */
export const createSMSWorker = () => {
    const worker = new Worker<SMSJobData>(SMS_QUEUE_NAME, processSMSJob, {
        connection: getRedisConnection(),
        ...defaultWorkerOptions,
    });

    // Event listeners for monitoring
    worker.on('completed', (job) => {
        console.log(`SMS job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`SMS job ${job?.id} failed:`, err);
    });

    worker.on('error', (err) => {
        console.error('SMS worker error:', err);
    });

    return worker;
};

/**
 * Gracefully close the SMS worker
 * Should be called during application shutdown
 * @param worker - The worker instance to close
 */
export const closeSMSWorker = async (worker: Worker): Promise<void> => {
    await worker.close();
};
