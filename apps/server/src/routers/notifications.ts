import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createWelcomeSMSJob,
  createOTPSMSJob,
  createNotificationSMSJob,
  type CreateWelcomeSMSJobParams,
  type CreateOTPSMSJobParams,
  type CreateNotificationSMSJobParams,
} from '@repo/queue';

const notifications = new Hono();

// Validation schemas
const welcomeSMSSchema = z.object({
  phoneNumber: z.string().min(9, 'Phone number must be at least 9 digits'),
  name: z.string().optional(),
  userName: z.string().min(1, 'User name is required'),
});

const otpSMSSchema = z.object({
  phoneNumber: z.string().min(9, 'Phone number must be at least 9 digits'),
  name: z.string().optional(),
  code: z.string().min(4, 'OTP code must be at least 4 characters'),
  expiryMinutes: z.number().min(1).max(60).default(10),
});

const notificationSMSSchema = z.object({
  phoneNumber: z.string().min(9, 'Phone number must be at least 9 digits'),
  name: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().min(1).max(10).optional(),
  delay: z.number().min(0).optional(),
});

/**
 * POST /api/notifications/sms/welcome
 * Send a welcome SMS to a new user
 */
notifications.post(
  '/sms/welcome',
  zValidator('json', welcomeSMSSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues,
      }, 400);
    }
  }),
  async (c) => {
    try {
      const data = c.req.valid('json');

      const params: CreateWelcomeSMSJobParams = {
        recipient: {
          phoneNumber: data.phoneNumber,
          name: data.name,
        },
        userName: data.userName,
      };

      const result = await createWelcomeSMSJob(params);

      return c.json({
        success: true,
        message: 'Welcome SMS queued successfully',
        data: {
          jobId: result.jobId,
          queueName: result.queueName,
        },
      }, 201);
    } catch (error) {
      console.error('Error queuing welcome SMS:', error);
      return c.json({
        success: false,
        message: 'Failed to queue welcome SMS',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * POST /api/notifications/sms/otp
 * Send an OTP SMS for verification
 */
notifications.post(
  '/sms/otp',
  zValidator('json', otpSMSSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues,
      }, 400);
    }
  }),
  async (c) => {
    try {
      const data = c.req.valid('json');

      const params: CreateOTPSMSJobParams = {
        recipient: {
          phoneNumber: data.phoneNumber,
          name: data.name,
        },
        code: data.code,
        expiryMinutes: data.expiryMinutes,
      };

      const result = await createOTPSMSJob(params);

      return c.json({
        success: true,
        message: 'OTP SMS queued successfully',
        data: {
          jobId: result.jobId,
          queueName: result.queueName,
        },
      }, 201);
    } catch (error) {
      console.error('Error queuing OTP SMS:', error);
      return c.json({
        success: false,
        message: 'Failed to queue OTP SMS',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

/**
 * POST /api/notifications/sms/notification
 * Send a generic notification SMS
 */
notifications.post(
  '/sms/notification',
  zValidator('json', notificationSMSSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues,
      }, 400);
    }
  }),
  async (c) => {
    try {
      const data = c.req.valid('json');

      const params: CreateNotificationSMSJobParams = {
        recipient: {
          phoneNumber: data.phoneNumber,
          name: data.name,
        },
        message: data.message,
        metadata: data.metadata,
      };

      const options = {
        priority: data.priority,
        delay: data.delay,
      };

      const result = await createNotificationSMSJob(params, options);

      return c.json({
        success: true,
        message: 'Notification SMS queued successfully',
        data: {
          jobId: result.jobId,
          queueName: result.queueName,
        },
      }, 201);
    } catch (error) {
      console.error('Error queuing notification SMS:', error);
      return c.json({
        success: false,
        message: 'Failed to queue notification SMS',
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  }
);

export default notifications;
