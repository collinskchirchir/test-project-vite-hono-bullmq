import type { WelcomeSMSData, TemplateResult } from '../../types';

/**
 * Renders a welcome SMS message for new users
 * @param data - Welcome SMS job data containing user information
 * @returns Formatted template result with message and recipient
 */
export const renderWelcomeSMS = (data: WelcomeSMSData): TemplateResult => {
  const message = `Welcome to our platform, ${data.userName}! We're excited to have you on board. Get started by exploring your dashboard.`;
  
  return {
    message,
    recipient: data.recipient,
  };
};
