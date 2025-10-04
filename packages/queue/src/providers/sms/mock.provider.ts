import type { SMSProvider, SMSResult } from './interface';

export class MockSMSProvider implements SMSProvider {
  getName(): string {
    return 'mock';
  }

  async send(phoneNumber: string, message: string): Promise<SMSResult> {
    console.log(`[MOCK SMS] Sending to ${phoneNumber}:`);
    console.log(`[MOCK SMS] Message: ${message}`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: this.getName(),
    };
  }
}
