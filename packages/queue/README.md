# @repo/queue

A scalable, type-safe notification queue system built with BullMQ and Redis for handling asynchronous SMS notifications (with extensibility for email and other notification types).

## Overview

`@repo/queue` provides a robust infrastructure for queueing and processing notifications across your monorepo. It separates the concerns of job creation (from your API/web app) and job processing (via background workers), enabling fast API responses while reliably delivering notifications in the background.

### Key Features

- **Type-Safe**: Full TypeScript support with discriminated unions for compile-time safety
- **Scalable**: Built on BullMQ and Redis for horizontal scaling
- **Extensible**: Easy to add new templates and notification types
- **Reliable**: Automatic retries with exponential backoff
- **Flexible**: Support for job priorities, delays, and custom options
- **Provider Agnostic**: Pluggable SMS providers (Salum, Mock, etc.)

## Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Redis server running locally or remotely

### Installation

This package is part of the monorepo and automatically available to workspace packages:

```typescript
import { createWelcomeSMSJob, createOTPSMSJob } from '@repo/queue';
```

### Environment Setup

Create a `.env` file with Redis configuration:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# SMS Provider
SMS_PROVIDER=mock  # Use 'salum' for production
SALUM_API_KEY=your-api-key
SALUM_PARTNER_ID=your-partner-id
SALUM_SHORTCODE=your-shortcode
```

### Basic Usage

#### 1. Queue a Welcome SMS

```typescript
import { createWelcomeSMSJob } from '@repo/queue';

// From your API endpoint
const result = await createWelcomeSMSJob({
  recipient: {
    phoneNumber: '+254712345678',
    name: 'John Doe'
  },
  userName: 'John'
});

console.log(`Job queued: ${result.jobId}`);
```

#### 2. Queue an OTP SMS

```typescript
import { createOTPSMSJob } from '@repo/queue';

const result = await createOTPSMSJob({
  recipient: {
    phoneNumber: '+254712345678'
  },
  code: '123456',
  expiryMinutes: 10
}, {
  priority: 1  // Higher priority for OTP
});
```

#### 3. Queue a Generic Notification

```typescript
import { createNotificationSMSJob } from '@repo/queue';

const result = await createNotificationSMSJob({
  recipient: {
    phoneNumber: '+254712345678',
    name: 'Jane'
  },
  message: 'Your order has been shipped!',
  metadata: { orderId: '12345' }
});
```

#### 4. Run Workers

Workers process jobs from the queue. Run them in a separate process or alongside your API:

```typescript
import { createSMSWorker } from '@repo/queue';

// Start the SMS worker
const worker = createSMSWorker();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});
```

## API Reference

### Job Creators

#### `createWelcomeSMSJob(params, options?)`

Queue a welcome SMS notification.

```typescript
interface CreateWelcomeSMSJobParams {
  recipient: SMSRecipient;
  userName: string;
}

interface SMSRecipient {
  phoneNumber: string;
  name?: string;
}
```

#### `createOTPSMSJob(params, options?)`

Queue an OTP verification SMS.

```typescript
interface CreateOTPSMSJobParams {
  recipient: SMSRecipient;
  code: string;
  expiryMinutes: number;
}
```

#### `createNotificationSMSJob(params, options?)`

Queue a generic notification SMS.

```typescript
interface CreateNotificationSMSJobParams {
  recipient: SMSRecipient;
  message: string;
  metadata?: Record<string, unknown>;
}
```

### Job Options

All job creators accept optional job options:

```typescript
interface JobOptions {
  priority?: number;    // Lower number = higher priority (default: 0)
  delay?: number;       // Delay in milliseconds before processing
  jobId?: string;       // Custom job ID for deduplication
}
```

### Workers

#### `createSMSWorker()`

Creates and starts an SMS worker that processes jobs from the SMS queue.

```typescript
const worker = createSMSWorker();

// Worker automatically handles:
// - Job processing with appropriate templates
// - Retries on failure (3 attempts with exponential backoff)
// - Logging and error handling
```

### Queue Instances

For monitoring and management:

```typescript
import { smsQueue } from '@repo/queue';

// Get queue stats
const jobCounts = await smsQueue.getJobCounts();

// Get specific job
const job = await smsQueue.getJob('job-id');

// Clean old jobs
await smsQueue.clean(24 * 3600 * 1000, 1000, 'completed');
```

## Architecture

```
┌─────────────────┐
│  API / Web App  │
└────────┬────────┘
         │ createJob()
         ▼
┌─────────────────┐
│   Job Creator   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   BullMQ Queue  │
│     (Redis)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Worker      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Template     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SMS Provider   │
└─────────────────┘
```

## Documentation

- [Getting Started Guide](./docs/getting-started.md) - Detailed setup and first steps
- [Architecture](./docs/architecture.md) - System design and components
- [Usage Guide](./docs/usage.md) - Comprehensive usage examples
- [Adding Templates](./docs/adding-templates.md) - How to extend with new templates
- [Deployment](./docs/deployment.md) - Production deployment strategies
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## SMS Providers

The package supports multiple SMS providers through a pluggable interface:

- **Mock Provider**: For development and testing (logs to console)
- **Salum Provider**: For production SMS delivery via Salum API

Configure via `SMS_PROVIDER` environment variable.

## Error Handling

Jobs automatically retry on failure:
- **Attempts**: 3 attempts per job
- **Backoff**: Exponential (2s, 4s, 8s)
- **Failed Jobs**: Kept for 7 days for debugging
- **Completed Jobs**: Kept for 24 hours

## Contributing

When adding new templates or notification types, follow the established patterns:

1. Add types to `src/types/index.ts`
2. Create template in `src/templates/{type}/`
3. Create job creator in `src/jobs/{type}/`
4. Update worker to handle new job type
5. Export from `src/index.ts`

See [Adding Templates Guide](./docs/adding-templates.md) for detailed instructions.

## License

Part of the monorepo project.
