// SMS job type enum
export enum SMSJobType {
    WELCOME = 'welcome',
    OTP = 'otp',
    NOTIFICATION = 'notification',
}

// Base job data interface
export interface BaseJobData {
    id: string;
    timestamp: number;
}

// SMS specific types
export interface SMSRecipient {
    phoneNumber: string;
    name?: string;
}

export interface WelcomeSMSData extends BaseJobData {
    type: SMSJobType.WELCOME;
    recipient: SMSRecipient;
    userName: string;
}

export interface OTPSMSData extends BaseJobData {
    type: SMSJobType.OTP;
    recipient: SMSRecipient;
    code: string;
    expiryMinutes: number;
}

export interface NotificationSMSData extends BaseJobData {
    type: SMSJobType.NOTIFICATION;
    recipient: SMSRecipient;
    message: string;
    metadata?: Record<string, unknown>;
}

// Discriminated union for all SMS job types
export type SMSJobData = WelcomeSMSData | OTPSMSData | NotificationSMSData;

// Template result
export interface TemplateResult {
    message: string;
    recipient: SMSRecipient;
}

// Job creation options
export interface JobOptions {
    priority?: number;
    delay?: number;
    jobId?: string;
}
