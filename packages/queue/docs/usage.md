# Usage Guide

This guide provides comprehensive examples of using `@repo/queue` in your applications, including usage from HonoJS API endpoints and Next.js applications.

## Table of Contents

- [Basic Job Creation](#basic-job-creation)
- [Using from HonoJS API](#using-from-honojs-api)
- [Using from Next.js](#using-from-nextjs)
- [Job Options](#job-options)
- [Queue Monitoring](#queue-monitoring)
- [Queue Management](#queue-management)

## Basic Job Creation

### Welcome SMS

Send a welcome message to new users:

```typescript
import { createWelcomeSMSJob } from '@repo/queue';

const result = await createWelcomeSMSJob({
  recipient: {
    phoneNumber: '+254712345678',
    name: 'John Doe'
  },
  userName: 'John'
});

console.log(`Job queued with ID: ${result.jobId}`);
// Output: Job queued with ID: 1234567890
```

**Generated Message**:
```
Welcome to our platform, John! We're excited to have you on board. Get started by exploring your dashboard.
```

### OTP SMS

Send a one-time password for verification:

```typescript
import { createOTPSMSJob } from '@repo/queue';

const result = await createOTPSMSJob({
  recipient: {
    phoneNumber: '+254712345678'
  },
  code: '123456',
  expiryMinutes: 10
});

console.log(`OTP job queued: ${result.jobId}`);
```

**Generated Message**:
```
Your verification code is: 123456. This code will expire in 10 minutes. Do not share this code with anyone.
```

### Generic Notification SMS

Send a custom notification message:

```typescript
import { createNotificationSMSJob } from '@repo/queue';

const result = await createNotificationSMSJob({
  recipient: {
    phoneNumber: '+254712345678',
    name: 'Jane Smith'
  },
  message: 'Your order #12345 has been shipped and will arrive in 2-3 business days.',
  metadata: {
    orderId: '12345',
    trackingNumber: 'TRK123456789'
  }
});
```

**Generated Message**:
```
Your order #12345 has been shipped and will arrive in 2-3 business days.
```

## Using from HonoJS API

### Basic Setup

Create a notifications router in your HonoJS API:

```typescript
// apps/server/src/routes/notifications.ts
import { Hono } from 'hono';
import {
  createWelcomeSMSJob,
  createOTPSMSJob,
  createNotificationSMSJob
} from '@repo/queue';

const app = new Hono();

export default app;
```

### Welcome SMS Endpoint

```typescript
app.post('/notifications/welcome', async (c) => {
  try {
    const { phoneNumber, userName } = await c.req.json();

    // Validate input
    if (!phoneNumber || !userName) {
      return c.json({
        success: false,
        error: 'phoneNumber and userName are required'
      }, 400);
    }

    // Queue the job
    const result = await createWelcomeSMSJob({
      recipient: {
        phoneNumber,
        name: userName
      },
      userName
    });

    return c.json({
      success: true,
      jobId: result.jobId,
      message: 'Welcome SMS queued successfully'
    });
  } catch (error) {
    console.error('Error queueing welcome SMS:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
```

**Usage**:
```bash
curl -X POST http://localhost:3000/notifications/welcome \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678",
    "userName": "John Doe"
  }'
```

### OTP SMS Endpoint

```typescript
app.post('/notifications/otp', async (c) => {
  try {
    const { phoneNumber, code, expiryMinutes = 10 } = await c.req.json();

    if (!phoneNumber || !code) {
      return c.json({
        success: false,
        error: 'phoneNumber and code are required'
      }, 400);
    }

    // Queue with high priority
    const result = await createOTPSMSJob({
      recipient: { phoneNumber },
      code,
      expiryMinutes
    }, {
      priority: 1  // Higher priority for OTP
    });

    return c.json({
      success: true,
      jobId: result.jobId,
      message: 'OTP SMS queued successfully'
    });
  } catch (error) {
    console.error('Error queueing OTP SMS:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
```

### Generic Notification Endpoint

```typescript
app.post('/notifications/send', async (c) => {
  try {
    const { phoneNumber, message, metadata } = await c.req.json();

    if (!phoneNumber || !message) {
      return c.json({
        success: false,
        error: 'phoneNumber and message are required'
      }, 400);
    }

    const result = await createNotificationSMSJob({
      recipient: { phoneNumber },
      message,
      metadata
    });

    return c.json({
      success: true,
      jobId: result.jobId,
      message: 'Notification SMS queued successfully'
    });
  } catch (error) {
    console.error('Error queueing notification SMS:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});
```

### Complete Router Example

```typescript
// apps/server/src/routes/notifications.ts
import { Hono } from 'hono';
import {
  createWelcomeSMSJob,
  createOTPSMSJob,
  createNotificationSMSJob
} from '@repo/queue';

const app = new Hono();

// Welcome SMS
app.post('/welcome', async (c) => {
  const { phoneNumber, userName } = await c.req.json();
  const result = await createWelcomeSMSJob({
    recipient: { phoneNumber, name: userName },
    userName
  });
  return c.json({ success: true, jobId: result.jobId });
});

// OTP SMS
app.post('/otp', async (c) => {
  const { phoneNumber, code, expiryMinutes = 10 } = await c.req.json();
  const result = await createOTPSMSJob({
    recipient: { phoneNumber },
    code,
    expiryMinutes
  }, { priority: 1 });
  return c.json({ success: true, jobId: result.jobId });
});

// Generic notification
app.post('/send', async (c) => {
  const { phoneNumber, message, metadata } = await c.req.json();
  const result = await createNotificationSMSJob({
    recipient: { phoneNumber },
    message,
    metadata
  });
  return c.json({ success: true, jobId: result.jobId });
});

export default app;
```

### Mounting the Router

```typescript
// apps/server/src/index.ts
import { Hono } from 'hono';
import notificationsRouter from './routes/notifications';

const app = new Hono();

app.route('/notifications', notificationsRouter);

export default app;
```

## Using from Next.js

### Server Actions

Use queue in Next.js Server Actions:

```typescript
// apps/web/src/actions/notifications.ts
'use server';

import { createWelcomeSMSJob, createOTPSMSJob } from '@repo/queue';

export async function sendWelcomeSMS(phoneNumber: string, userName: string) {
  try {
    const result = await createWelcomeSMSJob({
      recipient: { phoneNumber, name: userName },
      userName
    });

    return { success: true, jobId: result.jobId };
  } catch (error) {
    console.error('Error sending welcome SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function sendOTPSMS(phoneNumber: string, code: string) {
  try {
    const result = await createOTPSMSJob({
      recipient: { phoneNumber },
      code,
      expiryMinutes: 10
    }, {
      priority: 1
    });

    return { success: true, jobId: result.jobId };
  } catch (error) {
    console.error('Error sending OTP SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Using in Components

```typescript
// apps/web/src/components/signup-form.tsx
'use client';

import { useState } from 'react';
import { sendWelcomeSMS } from '@/actions/notifications';

export function SignupForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const phoneNumber = formData.get('phone') as string;
    const userName = formData.get('name') as string;

    // Send welcome SMS
    const result = await sendWelcomeSMS(phoneNumber, userName);

    if (result.success) {
      console.log('Welcome SMS queued:', result.jobId);
      // Show success message
    } else {
      console.error('Failed to queue SMS:', result.error);
      // Show error message
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Your name" required />
      <input name="phone" placeholder="+254712345678" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

### API Routes

Use queue in Next.js API routes:

```typescript
// apps/web/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createNotificationSMSJob } from '@repo/queue';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, message } = await request.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'phoneNumber and message are required' },
        { status: 400 }
      );
    }

    const result = await createNotificationSMSJob({
      recipient: { phoneNumber },
      message
    });

    return NextResponse.json({
      success: true,
      jobId: result.jobId
    });
  } catch (error) {
    console.error('Error queueing notification:', error);
    return NextResponse.json(
      { error: 'Failed to queue notification' },
      { status: 500 }
    );
  }
}
```

## Job Options

All job creators accept optional job options as the second parameter:

### Priority

Lower numbers = higher priority (default: 0):

```typescript
// High priority (processed first)
await createOTPSMSJob(params, { priority: 1 });

// Normal priority
await createWelcomeSMSJob(params, { priority: 5 });

// Low priority (processed last)
await createNotificationSMSJob(params, { priority: 10 });
```

### Delay

Delay job processing by milliseconds:

```typescript
// Send welcome SMS after 5 minutes
await createWelcomeSMSJob(params, {
  delay: 5 * 60 * 1000  // 5 minutes in milliseconds
});

// Send reminder after 1 hour
await createNotificationSMSJob({
  recipient: { phoneNumber: '+254712345678' },
  message: 'Reminder: Complete your profile'
}, {
  delay: 60 * 60 * 1000  // 1 hour
});
```

### Custom Job ID

Provide a custom job ID for deduplication:

```typescript
// Use user ID as job ID to prevent duplicate welcome messages
await createWelcomeSMSJob(params, {
  jobId: `welcome-${userId}`
});

// Use order ID for order notifications
await createNotificationSMSJob({
  recipient: { phoneNumber },
  message: 'Your order has shipped'
}, {
  jobId: `order-shipped-${orderId}`
});
```

**Note**: If a job with the same ID already exists in the queue, the new job will not be added.

### Combining Options

```typescript
await createOTPSMSJob({
  recipient: { phoneNumber: '+254712345678' },
  code: '123456',
  expiryMinutes: 10
}, {
  priority: 1,           // High priority
  delay: 2000,           // Wait 2 seconds
  jobId: `otp-${userId}` // Custom ID
});
```

## Queue Monitoring

### Get Queue Status

```typescript
import { smsQueue } from '@repo/queue';

// Get job counts
const counts = await smsQueue.getJobCounts();
console.log(counts);
// {
//   waiting: 5,
//   active: 2,
//   completed: 100,
//   failed: 3,
//   delayed: 1
// }
```

### Get Specific Job

```typescript
import { smsQueue } from '@repo/queue';

const job = await smsQueue.getJob('job-id-123');

if (job) {
  console.log('Job state:', await job.getState());
  console.log('Job data:', job.data);
  console.log('Job progress:', job.progress);
  console.log('Attempts made:', job.attemptsMade);
}
```

### Get Jobs by State

```typescript
import { smsQueue } from '@repo/queue';

// Get waiting jobs
const waitingJobs = await smsQueue.getWaiting();

// Get active jobs
const activeJobs = await smsQueue.getActive();

// Get completed jobs
const completedJobs = await smsQueue.getCompleted();

// Get failed jobs
const failedJobs = await smsQueue.getFailed();

// Get delayed jobs
const delayedJobs = await smsQueue.getDelayed();
```

### Monitor Queue in Real-Time

```typescript
import { smsQueue } from '@repo/queue';

// Listen to queue events
smsQueue.on('waiting', (job) => {
  console.log(`Job ${job.id} is waiting`);
});

smsQueue.on('active', (job) => {
  console.log(`Job ${job.id} is active`);
});

smsQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

smsQueue.on('failed', (job, err) => {
  console.log(`Job ${job.id} failed:`, err.message);
});
```

### Create Monitoring Endpoint

```typescript
// apps/server/src/routes/admin.ts
import { Hono } from 'hono';
import { smsQueue } from '@repo/queue';

const app = new Hono();

app.get('/queue/stats', async (c) => {
  const counts = await smsQueue.getJobCounts();
  
  return c.json({
    queue: 'sms',
    counts,
    timestamp: new Date().toISOString()
  });
});

app.get('/queue/failed', async (c) => {
  const failedJobs = await smsQueue.getFailed(0, 10);
  
  return c.json({
    total: failedJobs.length,
    jobs: failedJobs.map(job => ({
      id: job.id,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp
    }))
  });
});

export default app;
```

## Queue Management

### Clean Old Jobs

Remove completed and failed jobs to free up Redis memory:

```typescript
import { smsQueue } from '@repo/queue';

// Clean completed jobs older than 24 hours
await smsQueue.clean(24 * 3600 * 1000, 1000, 'completed');

// Clean failed jobs older than 7 days
await smsQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
```

### Retry Failed Jobs

```typescript
import { smsQueue } from '@repo/queue';

// Get failed jobs
const failedJobs = await smsQueue.getFailed();

// Retry all failed jobs
for (const job of failedJobs) {
  await job.retry();
}
```

### Remove Specific Job

```typescript
import { smsQueue } from '@repo/queue';

const job = await smsQueue.getJob('job-id-123');
if (job) {
  await job.remove();
}
```

### Pause and Resume Queue

```typescript
import { smsQueue } from '@repo/queue';

// Pause queue (stop processing new jobs)
await smsQueue.pause();

// Resume queue
await smsQueue.resume();

// Check if paused
const isPaused = await smsQueue.isPaused();
```

### Drain Queue

Remove all waiting jobs:

```typescript
import { smsQueue } from '@repo/queue';

await smsQueue.drain();
```

### Empty Queue

Remove all jobs (waiting, delayed, active, completed, failed):

```typescript
import { smsQueue } from '@repo/queue';

await smsQueue.obliterate({ force: true });
```

## Advanced Patterns

### Batch Job Creation

Queue multiple jobs efficiently:

```typescript
import { createWelcomeSMSJob } from '@repo/queue';

const users = [
  { phoneNumber: '+254712345678', userName: 'John' },
  { phoneNumber: '+254723456789', userName: 'Jane' },
  { phoneNumber: '+254734567890', userName: 'Bob' }
];

const results = await Promise.all(
  users.map(user => 
    createWelcomeSMSJob({
      recipient: { phoneNumber: user.phoneNumber },
      userName: user.userName
    })
  )
);

console.log(`Queued ${results.length} welcome messages`);
```

### Conditional Job Creation

Only queue if not already queued:

```typescript
import { smsQueue } from '@repo/queue';
import { createWelcomeSMSJob } from '@repo/queue';

const jobId = `welcome-${userId}`;

// Check if job already exists
const existingJob = await smsQueue.getJob(jobId);

if (!existingJob) {
  await createWelcomeSMSJob(params, { jobId });
}
```

### Job Chaining

Queue a follow-up job after completion:

```typescript
// In worker, after job completes
worker.on('completed', async (job) => {
  if (job.data.type === 'welcome') {
    // Queue a follow-up notification after 24 hours
    await createNotificationSMSJob({
      recipient: job.data.recipient,
      message: 'Have you explored your dashboard yet?'
    }, {
      delay: 24 * 60 * 60 * 1000  // 24 hours
    });
  }
});
```

### Error Handling with Retry Logic

```typescript
import { createOTPSMSJob } from '@repo/queue';

async function sendOTPWithRetry(phoneNumber: string, code: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await createOTPSMSJob({
        recipient: { phoneNumber },
        code,
        expiryMinutes: 10
      }, {
        priority: 1
      });

      return { success: true, jobId: result.jobId };
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        return { success: false, error: 'Max retries exceeded' };
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Best Practices

### 1. Always Handle Errors

```typescript
try {
  await createWelcomeSMSJob(params);
} catch (error) {
  console.error('Failed to queue job:', error);
  // Handle error appropriately
}
```

### 2. Use Appropriate Priorities

- **Priority 1**: Critical messages (OTP, security alerts)
- **Priority 5**: Normal messages (welcome, notifications)
- **Priority 10**: Low priority (marketing, reminders)

### 3. Set Reasonable Delays

Don't delay jobs unnecessarily. Use delays for:
- Scheduled notifications
- Rate limiting
- Follow-up messages

### 4. Use Custom Job IDs for Deduplication

Prevent duplicate messages by using meaningful job IDs:

```typescript
await createWelcomeSMSJob(params, {
  jobId: `welcome-${userId}-${Date.now()}`
});
```

### 5. Monitor Queue Health

Regularly check queue metrics:
- Failed job count
- Queue backlog
- Processing rate

### 6. Clean Old Jobs

Set up a cron job to clean old jobs:

```typescript
// Run daily
setInterval(async () => {
  await smsQueue.clean(24 * 3600 * 1000, 1000, 'completed');
  await smsQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
}, 24 * 60 * 60 * 1000);
```

## Next Steps

- Learn how to add custom templates: [Adding Templates](./adding-templates.md)
- Deploy to production: [Deployment Guide](./deployment.md)
- Troubleshoot issues: [Troubleshooting](./troubleshooting.md)
