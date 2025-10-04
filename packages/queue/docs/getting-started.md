# Getting Started with @repo/queue

This guide will walk you through setting up and using the notification queue system in your project.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** or **Bun** - JavaScript runtime
- **Redis** - In-memory data store used by BullMQ
- **Git** - For cloning the repository

### Installing Redis

#### macOS (using Homebrew)

```bash
brew install redis
brew services start redis
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Docker

```bash
docker run -d -p 6379:6379 redis:7-alpine
```

#### Verify Redis Installation

```bash
redis-cli ping
# Should return: PONG
```

## Installation

The `@repo/queue` package is part of the monorepo and is automatically available to other workspace packages. No separate installation is needed.

### Workspace Setup

If you're adding this to a new app in the monorepo, add it to your `package.json`:

```json
{
  "dependencies": {
    "@repo/queue": "workspace:*"
  }
}
```

Then run:

```bash
bun install
```

## Environment Configuration

### 1. Create Environment File

Create a `.env` file in your application directory (e.g., `apps/server/.env`):

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# SMS Provider Configuration
SMS_PROVIDER=mock  # Use 'mock' for development, 'salum' for production

# Salum SMS Provider (only needed if SMS_PROVIDER=salum)
SALUM_API_KEY=your-api-key-here
SALUM_PARTNER_ID=your-partner-id-here
SALUM_SHORTCODE=your-shortcode-here
```

### 2. Environment Variables Explained

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | No | `localhost` | Redis server hostname |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis password (if authentication enabled) |
| `REDIS_DB` | No | `0` | Redis database number (0-15) |
| `SMS_PROVIDER` | No | `mock` | SMS provider to use (`mock` or `salum`) |
| `SALUM_API_KEY` | Yes* | - | Salum API key (*required if using Salum) |
| `SALUM_PARTNER_ID` | Yes* | - | Salum partner ID (*required if using Salum) |
| `SALUM_SHORTCODE` | No | `BURETI-TEA` | Salum SMS shortcode |

### 3. Development vs Production

**Development:**
```bash
SMS_PROVIDER=mock
```
Uses the mock provider which logs SMS messages to the console instead of sending them.

**Production:**
```bash
SMS_PROVIDER=salum
SALUM_API_KEY=your-actual-key
SALUM_PARTNER_ID=your-actual-id
```
Uses the Salum provider to send real SMS messages.

## Running Your First Job

### Step 1: Queue a Job from Your API

Create an API endpoint that queues a welcome SMS:

```typescript
// apps/server/src/routes/notifications.ts
import { Hono } from 'hono';
import { createWelcomeSMSJob } from '@repo/queue';

const app = new Hono();

app.post('/send-welcome', async (c) => {
  try {
    const { phoneNumber, userName } = await c.req.json();

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
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
```

### Step 2: Start Your API Server

```bash
cd apps/server
bun run dev
```

### Step 3: Create a Worker Script

Create a worker script to process queued jobs:

```typescript
// apps/server/src/workers/start-workers.ts
import { createSMSWorker } from '@repo/queue';

console.log('Starting SMS worker...');

const smsWorker = createSMSWorker();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers...');
  await smsWorker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('SMS worker started successfully');
```

### Step 4: Run the Worker

In a separate terminal:

```bash
cd apps/server
bun src/workers/start-workers.ts
```

You should see:
```
Starting SMS worker...
SMS worker started successfully
```

### Step 5: Test the System

Send a request to your API:

```bash
curl -X POST http://localhost:3000/send-welcome \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678",
    "userName": "John Doe"
  }'
```

Expected response:
```json
{
  "success": true,
  "jobId": "1234567890",
  "message": "Welcome SMS queued successfully"
}
```

In the worker terminal, you should see:
```
Processing SMS job 1234567890 of type welcome
[MOCK SMS] Sending to +254712345678:
[MOCK SMS] Message: Welcome to our platform, John Doe! We're excited to have you on board. Get started by exploring your dashboard.
Successfully sent SMS job 1234567890 via mock, messageId: mock-1234567890-abc123
SMS job 1234567890 completed
```

## Running Workers Locally

### Option 1: Separate Process (Recommended)

Run workers in a dedicated process for better isolation:

```bash
# Terminal 1: API Server
cd apps/server
bun run dev

# Terminal 2: Workers
cd apps/server
bun src/workers/start-workers.ts
```

### Option 2: Same Process (Development)

For simpler local development, start workers in your API server:

```typescript
// apps/server/src/index.ts
import { Hono } from 'hono';
import { createSMSWorker } from '@repo/queue';

const app = new Hono();

// Start worker alongside API
const worker = createSMSWorker();

// Your routes...
app.get('/', (c) => c.text('Hello!'));

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

export default app;
```

### Option 3: Using Docker Compose

Add workers to your `docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - SMS_PROVIDER=mock
    depends_on:
      - redis

  worker:
    build: .
    command: bun src/workers/start-workers.ts
    environment:
      - REDIS_HOST=redis
      - SMS_PROVIDER=mock
    depends_on:
      - redis

volumes:
  redis-data:
```

## Verifying the Setup

### 1. Check Redis Connection

```typescript
import { getRedisConnection } from '@repo/queue';
import Redis from 'ioredis';

const redis = new Redis(getRedisConnection());

redis.ping().then(() => {
  console.log('✓ Redis connected');
  redis.quit();
}).catch((err) => {
  console.error('✗ Redis connection failed:', err);
});
```

### 2. Check Queue Status

```typescript
import { smsQueue } from '@repo/queue';

const counts = await smsQueue.getJobCounts();
console.log('Queue status:', counts);
// { waiting: 0, active: 0, completed: 5, failed: 0, delayed: 0 }
```

### 3. Monitor Worker Activity

Workers log activity to the console:
- Job processing start
- Job completion
- Job failures
- Worker errors

## Next Steps

Now that you have the basic setup working:

1. **Explore Usage Examples**: See [Usage Guide](./usage.md) for more examples
2. **Learn the Architecture**: Understand the system in [Architecture](./architecture.md)
3. **Add Custom Templates**: Follow [Adding Templates](./adding-templates.md)
4. **Deploy to Production**: Read [Deployment Guide](./deployment.md)

## Common Issues

### Redis Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**: Ensure Redis is running:
```bash
redis-cli ping
```

### Worker Not Processing Jobs

**Solution**: Check that:
1. Worker is running
2. Redis connection is working
3. Jobs are being added to the queue
4. No errors in worker logs

### Jobs Failing Immediately

**Solution**: Check:
1. Environment variables are set correctly
2. SMS provider configuration is valid
3. Worker logs for specific error messages

For more troubleshooting help, see [Troubleshooting Guide](./troubleshooting.md).
