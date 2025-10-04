import { smsQueue } from '../../queues/sms.queue';
import type { NotificationSMSData, SMSRecipient, JobOptions } from '../../types';
import { SMSJobType } from '../../types';

export interface CreateNotificationSMSJobParams {
    recipient: SMSRecipient;
    message: string;
    metadata?: Record<string, unknown>;
}

export const createNotificationSMSJob = async (
    params: CreateNotificationSMSJobParams,
    options?: JobOptions
) => {
    const jobData: NotificationSMSData = {
        type: SMSJobType.NOTIFICATION,
        id: options?.jobId || crypto.randomUUID(),
        timestamp: Date.now(),
        recipient: params.recipient,
        message: params.message,
        metadata: params.metadata,
    };

    const job = await smsQueue.add('notification-sms', jobData, {
        priority: options?.priority,
        delay: options?.delay,
        jobId: options?.jobId,
    });

    return {
        jobId: job.id,
        queueName: smsQueue.name,
    };
};
