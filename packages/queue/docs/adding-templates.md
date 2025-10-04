# Adding Templates Guide

This guide shows you how to extend the notification queue system with new templates and notification types.

## Table of Contents

- [Adding a New SMS Template](#adding-a-new-sms-template)
- [Adding a New Notification Type (Email)](#adding-a-new-notification-type-email)
- [Type Safety Considerations](#type-safety-considerations)
- [Testing Your Templates](#testing-your-templates)

## Adding a New SMS Template

Let's add a password reset SMS template as an example.

### Step 1: Add Type Definition

Add the new type to `src/types/index.ts`:

```typescript
// src/types/index.ts

// ... existing types ...

export interface PasswordResetSMSData extends BaseJobData {
  type: 'password-reset';
  recipient: SMSRecipient;
  resetLink: string;
  expiryMinutes: number;
}

// Update the discriminated union
export type SMSJobData = 
  | WelcomeSMSData 
  | OTPSMSData 
  | NotificationSMSData
  | PasswordResetSMSData;  // Add new type here
```

### Step 2: Create Template Function

Create `src/templates/sms/password-reset.ts`:

```typescript
// src/templates/sms/password-reset.ts
import type { PasswordResetSMSData, TemplateResult } from '../../types';

export const renderPasswordResetSMS = (data: PasswordResetSMSData): TemplateResult => {
  const message = `You requested a password reset. Click this link to reset your password: ${data.resetLink}. This link will expire in ${data.expiryMinutes} minutes. If you didn't request this, please ignore this message.`;
  
  return {
    message,
    recipient: data.recipient,
  };
};
```

### Step 3: Export Template

Update `src/templates/sms/index.ts`:

```typescript
// src/templates/sms/index.ts
export { renderWelcomeSMS } from './welcome';
export { renderOTPSMS } from './otp';
export { renderNotificationSMS } from './notification';
export { renderPasswordResetSMS } from './password-reset';  // Add this
```

### Step 4: Create Job Creator

Create `src/jobs/sms/password-reset.job.ts`:

```typescript
// src/jobs/sms/password-reset.job.ts
import { smsQueue } from '../../queues/sms.queue';
import type { PasswordResetSMSData, SMSRecipient, JobOptions } from '../../types';

export interface CreatePasswordResetSMSJobParams {
  recipient: SMSRecipient;
  resetLink: string;
  expiryMinutes: number;
}

export const createPasswordResetSMSJob = async (
  params: CreatePasswordResetSMSJobParams,
  options?: JobOptions
) => {
  const jobData: PasswordResetSMSData = {
    type: 'password-reset',
    id: options?.jobId || crypto.randomUUID(),
    timestamp: Date.now(),
    recipient: params.recipient,
    resetLink: params.resetLink,
    expiryMinutes: params.expiryMinutes,
  };

  const job = await smsQueue.add('password-reset-sms', jobData, {
    priority: options?.priority || 1,  // High priority for security
    delay: options?.delay,
    jobId: options?.jobId,
  });

  return {
    jobId: job.id,
    queueName: smsQueue.name,
  };
};
```

### Step 5: Export Job Creator

Update `src/jobs/sms/index.ts`:

```typescript
// src/jobs/sms/index.ts
export { createWelcomeSMSJob } from './welcome.job';
export { createOTPSMSJob } from './otp.job';
export { createNotificationSMSJob } from './notification.job';
export { createPasswordResetSMSJob } from './password-reset.job';  // Add this

// Export types
export type { CreateWelcomeSMSJobParams } from './welcome.job';
export type { CreateOTPSMSJobParams } from './otp.job';
export type { CreateNotificationSMSJobParams } from './notification.job';
export type { CreatePasswordResetSMSJobParams } from './password-reset.job';  // Add this
```

### Step 6: Update Worker

Update `src/workers/sms.worker.ts` to handle the new job type:

```typescript
// src/workers/sms.worker.ts
import { renderPasswordResetSMS } from '../templates/sms/password-reset';

const processSMSJob = async (job: Job<SMSJobData>) => {
  console.log(`Processing SMS job ${job.id} of type ${job.data.type}`);

  let templateResult;

  switch (job.data.type) {
    case 'welcome':
      templateResult = renderWelcomeSMS(job.data);
      break;
    case 'otp':
      templateResult = renderOTPSMS(job.data);
      break;
    case 'notification':
      templateResult = renderNotificationSMS(job.data);
      break;
    case 'password-reset':  // Add this case
      templateResult = renderPasswordResetSMS(job.data);
      break;
    default:
      const _exhaustive: never = job.data;
      throw new Error(`Unknown SMS job type: ${(_exhaustive as any).type}`);
  }

  // ... rest of the function
};
```

### Step 7: Export from Main Index

Update `src/index.ts`:

```typescript
// src/index.ts

// Export job creators
export { 
  createWelcomeSMSJob,
  createOTPSMSJob,
  createNotificationSMSJob,
  createPasswordResetSMSJob  // Add this
} from './jobs/sms';

// Export types
export type {
  CreateWelcomeSMSJobParams,
  CreateOTPSMSJobParams,
  CreateNotificationSMSJobParams,
  CreatePasswordResetSMSJobParams  // Add this
} from './jobs/sms';

// ... rest of exports
```

### Step 8: Use Your New Template

```typescript
import { createPasswordResetSMSJob } from '@repo/queue';

await createPasswordResetSMSJob({
  recipient: {
    phoneNumber: '+254712345678',
    name: 'John Doe'
  },
  resetLink: 'https://example.com/reset?token=abc123',
  expiryMinutes: 30
}, {
  priority: 1  // High priority for security
});
```

## Adding a New Notification Type (Email)

Let's add email notification support as an example of adding a completely new notification type.

### Step 1: Add Email Types

Create `src/types/email.ts`:

```typescript
// src/types/email.ts
import type { BaseJobData } from './index';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface WelcomeEmailData extends BaseJobData {
  type: 'welcome';
  recipient: EmailRecipient;
  userName: string;
}

export interface PasswordResetEmailData extends BaseJobData {
  type: 'password-reset';
  recipient: EmailRecipient;
  resetLink: string;
  expiryMinutes: number;
}

export type EmailJobData = WelcomeEmailData | PasswordResetEmailData;

export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
  recipient: EmailRecipient;
}
```

Update `src/types/index.ts`:

```typescript
// src/types/index.ts
export * from './email';

// ... existing exports
```

### Step 2: Create Email Queue

Create `src/queues/email.queue.ts`:

```typescript
// src/queues/email.queue.ts
import { Queue } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { defaultQueueOptions } from '../config/queue-options';
import type { EmailJobData } from '../types/email';

export const EMAIL_QUEUE_NAME = 'email-notifications';

export const emailQueue = new Queue<EmailJobData>(
  EMAIL_QUEUE_NAME,
  {
    connection: getRedisConnection(),
    ...defaultQueueOptions,
  }
);

export const closeEmailQueue = async () => {
  await emailQueue.close();
};
```

Update `src/queues/index.ts`:

```typescript
// src/queues/index.ts
export { smsQueue, closeSMSQueue } from './sms.queue';
export { emailQueue, closeEmailQueue } from './email.queue';
```

### Step 3: Create Email Provider Interface

Create `src/providers/email/interface.ts`:

```typescript
// src/providers/email/interface.ts
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface EmailProvider {
  send(to: string, subject: string, html: string, text: string): Promise<EmailResult>;
  getName(): string;
}
```

### Step 4: Create Mock Email Provider

Create `src/providers/email/mock.provider.ts`:

```typescript
// src/providers/email/mock.provider.ts
import type { EmailProvider, EmailResult } from './interface';

export class MockEmailProvider implements EmailProvider {
  getName(): string {
    return 'mock';
  }

  async send(to: string, subject: string, html: string, text: string): Promise<EmailResult> {
    console.log(`[MOCK EMAIL] Sending to ${to}`);
    console.log(`[MOCK EMAIL] Subject: ${subject}`);
    console.log(`[MOCK EMAIL] Text: ${text}`);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `mock-email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider: this.getName(),
    };
  }
}
```

### Step 5: Create Email Provider Factory

Create `src/providers/email/factory.ts`:

```typescript
// src/providers/email/factory.ts
import type { EmailProvider } from './interface';
import { MockEmailProvider } from './mock.provider';

export const createEmailProvider = (): EmailProvider => {
  const provider = process.env.EMAIL_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'mock':
      return new MockEmailProvider();
    // Add other providers here (SendGrid, AWS SES, etc.)
    default:
      console.warn(`Unknown email provider: ${provider}, falling back to mock`);
      return new MockEmailProvider();
  }
};
```

Create `src/providers/email/index.ts`:

```typescript
// src/providers/email/index.ts
export { createEmailProvider } from './factory';
export type { EmailProvider, EmailResult } from './interface';
```

Update `src/providers/index.ts`:

```typescript
// src/providers/index.ts
export * from './sms';
export * from './email';
```

### Step 6: Create Email Templates

Create `src/templates/email/welcome.ts`:

```typescript
// src/templates/email/welcome.ts
import type { WelcomeEmailData, EmailTemplateResult } from '../../types/email';

export const renderWelcomeEmail = (data: WelcomeEmailData): EmailTemplateResult => {
  const subject = `Welcome to our platform, ${data.userName}!`;
  
  const html = `
    <html>
      <body>
        <h1>Welcome ${data.userName}!</h1>
        <p>We're excited to have you on board.</p>
        <p>Get started by exploring your dashboard.</p>
      </body>
    </html>
  `;
  
  const text = `Welcome ${data.userName}! We're excited to have you on board. Get started by exploring your dashboard.`;
  
  return {
    subject,
    html,
    text,
    recipient: data.recipient,
  };
};
```

Create `src/templates/email/index.ts`:

```typescript
// src/templates/email/index.ts
export { renderWelcomeEmail } from './welcome';
```

Update `src/templates/index.ts`:

```typescript
// src/templates/index.ts
export * from './sms';
export * from './email';
```

### Step 7: Create Email Job Creators

Create `src/jobs/email/welcome.job.ts`:

```typescript
// src/jobs/email/welcome.job.ts
import { emailQueue } from '../../queues/email.queue';
import type { WelcomeEmailData, EmailRecipient } from '../../types/email';
import type { JobOptions } from '../../types';

export interface CreateWelcomeEmailJobParams {
  recipient: EmailRecipient;
  userName: string;
}

export const createWelcomeEmailJob = async (
  params: CreateWelcomeEmailJobParams,
  options?: JobOptions
) => {
  const jobData: WelcomeEmailData = {
    type: 'welcome',
    id: options?.jobId || crypto.randomUUID(),
    timestamp: Date.now(),
    recipient: params.recipient,
    userName: params.userName,
  };

  const job = await emailQueue.add('welcome-email', jobData, {
    priority: options?.priority,
    delay: options?.delay,
    jobId: options?.jobId,
  });

  return {
    jobId: job.id,
    queueName: emailQueue.name,
  };
};
```

Create `src/jobs/email/index.ts`:

```typescript
// src/jobs/email/index.ts
export { createWelcomeEmailJob } from './welcome.job';
export type { CreateWelcomeEmailJobParams } from './welcome.job';
```

Update `src/jobs/index.ts`:

```typescript
// src/jobs/index.ts
export * from './sms';
export * from './email';
```

### Step 8: Create Email Worker

Create `src/workers/email.worker.ts`:

```typescript
// src/workers/email.worker.ts
import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis';
import { defaultWorkerOptions } from '../config/queue-options';
import { EMAIL_QUEUE_NAME } from '../queues/email.queue';
import type { EmailJobData } from '../types/email';
import { renderWelcomeEmail } from '../templates/email/welcome';
import { createEmailProvider } from '../providers/email/factory';
import type { EmailProvider } from '../providers/email/interface';

const emailProvider: EmailProvider = createEmailProvider();

const processEmailJob = async (job: Job<EmailJobData>) => {
  console.log(`Processing email job ${job.id} of type ${job.data.type}`);

  let templateResult;

  switch (job.data.type) {
    case 'welcome':
      templateResult = renderWelcomeEmail(job.data);
      break;
    case 'password-reset':
      // Add other email templates here
      throw new Error('Password reset email not implemented yet');
    default:
      const _exhaustive: never = job.data;
      throw new Error(`Unknown email job type: ${(_exhaustive as any).type}`);
  }

  const result = await emailProvider.send(
    templateResult.recipient.email,
    templateResult.subject,
    templateResult.html,
    templateResult.text
  );

  if (!result.success) {
    throw new Error(`Email send failed: ${result.error}`);
  }

  console.log(`Successfully sent email job ${job.id} via ${result.provider}, messageId: ${result.messageId}`);
  
  return { 
    success: true, 
    jobId: job.id,
    messageId: result.messageId,
    provider: result.provider,
  };
};

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: getRedisConnection(),
      ...defaultWorkerOptions,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Email job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Email job ${job?.id} failed:`, err);
  });

  worker.on('error', (err) => {
    console.error('Email worker error:', err);
  });

  return worker;
};

export const closeEmailWorker = async (worker: Worker) => {
  await worker.close();
};
```

Update `src/workers/index.ts`:

```typescript
// src/workers/index.ts
export { createSMSWorker, closeSMSWorker } from './sms.worker';
export { createEmailWorker, closeEmailWorker } from './email.worker';
```

### Step 9: Export from Main Index

Update `src/index.ts`:

```typescript
// src/index.ts

// Export job creators
export * from './jobs';

// Export types
export * from './types';

// Export queue instances
export { smsQueue, closeSMSQueue } from './queues/sms.queue';
export { emailQueue, closeEmailQueue } from './queues/email.queue';

// Export worker creators
export { createSMSWorker, closeSMSWorker } from './workers/sms.worker';
export { createEmailWorker, closeEmailWorker } from './workers/email.worker';

// Export config
export { getRedisConfig, getRedisConnection } from './config/redis';
```

### Step 10: Use Your New Email Notification

```typescript
import { createWelcomeEmailJob } from '@repo/queue';

await createWelcomeEmailJob({
  recipient: {
    email: 'user@example.com',
    name: 'John Doe'
  },
  userName: 'John'
});
```

### Step 11: Start Email Worker

```typescript
// apps/server/src/workers/start-workers.ts
import { createSMSWorker, createEmailWorker } from '@repo/queue';

console.log('Starting workers...');

const smsWorker = createSMSWorker();
const emailWorker = createEmailWorker();

const shutdown = async () => {
  console.log('Shutting down workers...');
  await smsWorker.close();
  await emailWorker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('All workers started successfully');
```

## Type Safety Considerations

### 1. Discriminated Unions

Always use discriminated unions with a `type` field:

```typescript
export type SMSJobData = 
  | { type: 'welcome', ... }
  | { type: 'otp', ... }
  | { type: 'notification', ... };
```

This enables TypeScript to narrow types in switch statements.

### 2. Exhaustiveness Checking

Use the `never` type to ensure all cases are handled:

```typescript
switch (job.data.type) {
  case 'welcome':
    // handle welcome
    break;
  case 'otp':
    // handle otp
    break;
  default:
    const _exhaustive: never = job.data;
    throw new Error(`Unknown type: ${(_exhaustive as any).type}`);
}
```

If you add a new type but forget to handle it in the switch, TypeScript will show an error.

### 3. Template Function Signatures

Template functions should accept specific types and return specific results:

```typescript
export const renderWelcomeSMS = (data: WelcomeSMSData): TemplateResult => {
  // TypeScript ensures data has all required fields
  // and return value matches TemplateResult
};
```

### 4. Job Creator Type Safety

Job creators should have typed parameters:

```typescript
export interface CreateWelcomeSMSJobParams {
  recipient: SMSRecipient;
  userName: string;
}

export const createWelcomeSMSJob = async (
  params: CreateWelcomeSMSJobParams,
  options?: JobOptions
) => {
  // TypeScript ensures params match the interface
};
```

### 5. Export Types

Always export types alongside functions:

```typescript
export { createWelcomeSMSJob } from './welcome.job';
export type { CreateWelcomeSMSJobParams } from './welcome.job';
```

This allows consumers to import types for their own code.

## Testing Your Templates

### Unit Test Template Function

```typescript
// src/templates/sms/__tests__/password-reset.test.ts
import { describe, it, expect } from 'vitest';
import { renderPasswordResetSMS } from '../password-reset';
import type { PasswordResetSMSData } from '../../../types';

describe('renderPasswordResetSMS', () => {
  it('should render password reset message correctly', () => {
    const data: PasswordResetSMSData = {
      type: 'password-reset',
      id: 'test-123',
      timestamp: Date.now(),
      recipient: {
        phoneNumber: '+254712345678',
        name: 'John Doe'
      },
      resetLink: 'https://example.com/reset?token=abc123',
      expiryMinutes: 30
    };

    const result = renderPasswordResetSMS(data);

    expect(result.message).toContain('password reset');
    expect(result.message).toContain(data.resetLink);
    expect(result.message).toContain('30 minutes');
    expect(result.recipient).toEqual(data.recipient);
  });
});
```

### Integration Test Job Creator

```typescript
// src/jobs/sms/__tests__/password-reset.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createPasswordResetSMSJob } from '../password-reset.job';
import { smsQueue } from '../../../queues/sms.queue';

describe('createPasswordResetSMSJob', () => {
  afterAll(async () => {
    await smsQueue.close();
  });

  it('should create password reset job', async () => {
    const result = await createPasswordResetSMSJob({
      recipient: {
        phoneNumber: '+254712345678'
      },
      resetLink: 'https://example.com/reset?token=abc123',
      expiryMinutes: 30
    });

    expect(result.jobId).toBeDefined();
    expect(result.queueName).toBe('sms-notifications');

    // Verify job was added to queue
    const job = await smsQueue.getJob(result.jobId!);
    expect(job).toBeDefined();
    expect(job?.data.type).toBe('password-reset');
  });
});
```

## Checklist

When adding a new template, ensure you:

- [ ] Add type definition to `src/types/`
- [ ] Update discriminated union type
- [ ] Create template function
- [ ] Export template from index
- [ ] Create job creator function
- [ ] Export job creator from index
- [ ] Update worker switch statement
- [ ] Export from main `src/index.ts`
- [ ] Add unit tests for template
- [ ] Add integration tests for job creator
- [ ] Update documentation

## Best Practices

1. **Keep templates pure**: No side effects, just data transformation
2. **Use descriptive names**: `renderPasswordResetSMS` not `renderPR`
3. **Validate data**: Use TypeScript types to ensure data correctness
4. **Test thoroughly**: Unit test templates, integration test job creators
5. **Document parameters**: Add JSDoc comments for complex parameters
6. **Follow patterns**: Maintain consistency with existing code
7. **Consider i18n**: Plan for internationalization if needed

## Next Steps

- Deploy your changes: [Deployment Guide](./deployment.md)
- Monitor your queues: [Usage Guide](./usage.md#queue-monitoring)
- Troubleshoot issues: [Troubleshooting](./troubleshooting.md)
