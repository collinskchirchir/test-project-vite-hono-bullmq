import type { SMSProvider } from './interface';
import { SalumSMSProvider } from './salum.provider';
import { MockSMSProvider } from './mock.provider';

export const createSMSProvider = (): SMSProvider => {
  const provider = process.env.SMS_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'salum':
      return new SalumSMSProvider();
    case 'mock':
      return new MockSMSProvider();
    default:
      console.warn(`Unknown SMS provider: ${provider}, falling back to mock`);
      return new MockSMSProvider();
  }
};
