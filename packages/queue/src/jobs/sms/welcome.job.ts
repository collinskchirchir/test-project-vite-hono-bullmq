import { smsQueue } from '../../queues/sms.queue';
import type { WelcomeSMSData, SMSRecipient, JobOptions } from '../../types';
import { SMSJobType } from '../../types';

export interface CreateWelcomeSMSJobParams {
  recipient: SMSRecipient;
  userName: string;
}

export const createWelcomeSMSJob = async (
  params: CreateWelcomeSMSJobParams,
  options?: JobOptions
) => {
  const jobData: WelcomeSMSData = {
    type: SMSJobType.WELCOME,
    id: options?.jobId || crypto.randomUUID(),
    timestamp: Date.now(),
    recipient: params.recipient,
    userName: params.userName,
  };

  const job = await smsQueue.add('welcome-sms', jobData, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  });

  return {
    jobId: job.id,
    queueName: smsQueue.name,
  };
};
