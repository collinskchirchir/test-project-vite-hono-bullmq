import type { NotificationSMSData, TemplateResult } from '../../types';

/**
 * Renders a generic notification SMS message
 * @param data - Notification SMS job data containing the message to send
 * @returns Formatted template result with message and recipient
 */
export const renderNotificationSMS = (data: NotificationSMSData): TemplateResult => {
  return {
    message: data.message,
    recipient: data.recipient,
  };
};
