export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface SMSProvider {
  send(phoneNumber: string, message: string): Promise<SMSResult>;
  getName(): string;
}
