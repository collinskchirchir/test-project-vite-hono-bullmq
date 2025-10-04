import { smsQueue } from '../../queues/sms.queue';
import type { OTPSMSData, SMSRecipient, JobOptions } from '../../types';
import { SMSJobType } from '../../types';

export interface CreateOTPSMSJobParams {
  recipient: SMSRecipient;
  code: string;
  expiryMinutes: number;
}

export const createOTPSMSJob = async (
  params: CreateOTPSMSJobParams,
  options?: JobOptions
) => {
  const jobData: OTPSMSData = {
    type: SMSJobType.OTP,
    id: options?.jobId || crypto.randomUUID(),
    timestamp: Date.now(),
    recipient: params.recipient,
    code: params.code,
    expiryMinutes: params.expiryMinutes,
  };

  const job = await smsQueue.add('otp-sms', jobData, {
    priority: options?.priority || 1, // OTP has higher priority
    delay: options?.delay,
    jobId: options?.jobId,
  });

  return {
    jobId: job.id,
    queueName: smsQueue.name,
  };
};
