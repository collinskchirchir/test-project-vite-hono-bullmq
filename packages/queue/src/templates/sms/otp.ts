import type { OTPSMSData, TemplateResult } from '../../types';

/**
 * Renders an OTP (One-Time Password) SMS message for verification
 * @param data - OTP SMS job data containing verification code and expiry information
 * @returns Formatted template result with message and recipient
 */
export const renderOTPSMS = (data: OTPSMSData): TemplateResult => {
  const message = `Your verification code is: ${data.code}. This code will expire in ${data.expiryMinutes} minutes. Do not share this code with anyone.`;
  
  return {
    message,
    recipient: data.recipient,
  };
};
