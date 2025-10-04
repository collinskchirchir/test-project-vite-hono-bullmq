# Deployment Guide

This guide covers deploying the notification queue system to production, including worker deployment strategies, environment configuration, and scaling considerations.

## Table of Contents

- [Deployment Strategies](#deployment-strategies)
- [Environment Configuration](#environment-configuration)
- [Worker Deployment](#worker-deployment)
- [Redis Configuration](#redis-configuration)
- [Horizontal Scaling](#horizontal-scaling)
- [Monitoring and Logging](#monitoring-and-logging)
- [Security Best Practices](#security-best-practices)

## Deployment Strategies

### Strategy 1: Separate Worker Process (Recommended)

Deploy workers as separate processes/containers from your API for better isolation and independent scaling.

**Pros**:
- Independent scaling of API and workers
- Better resource isolation
- Easier to debug and monitor
- Can restart workers without affecting API
- Better fault isolation

**Cons**:
- More infrastructure complexity
- Additional deployment configuration

**Use Case**: Production environments, high-traffic applications

### Strategy 2: Same Process (Development)

Run workers in the same process as your API for simpler local development.

**Pros**:
- Simpler setup
- Fewer moving parts
- Easier local development
- Lower infrastructure costs

**Cons**:
- Workers and API compete for resources
- Harder to scale independently
- API restarts affect workers

**Use Case**: Development, staging, low-traffic applications

## Environment Configuration

### Required Environment Variables

```bash
# Redis Configuration
REDIS_HOST=your-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password
REDIS_DB=0

# SMS Provider
SMS_PROVIDER=salum
SALUM_API_KEY=your-api-key
SALUM_PARTNER_ID=your-partner-id
SALUM_SHORTCODE=your-shortcode
```

### Development Environment

```bash
# .env.development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

SMS_PROVIDER=mock
```

### Staging Environment

```bash
# .env.staging
REDIS_HOST=staging-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=staging-password
REDIS_DB=0

SMS_PROVIDER=salum
SALUM_API_KEY=staging-api-key
SALUM_PARTNER_ID=staging-partner-id
SALUM_SHORTCODE=STAGING
```

### Production Environment

```bash
# .env.production
REDIS_HOST=prod-redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=strong-production-password
REDIS_DB=0

SMS_PROVIDER=salum
SALUM_API_KEY=production-api-key
SALUM_PARTNER_ID=production-partner-id
SALUM_SHORTCODE=PROD
```

### Environment Variable Management

**Option 1: Environment Files**
```bash
# Load from file
export $(cat .env.production | xargs)
```

**Option 2: Secret Management Services**
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets
- Docker Secrets

**Option 3: Platform Environment Variables**
- Heroku Config Vars
- Vercel Environment Variables
- Railway Environment Variables
- Render Environment Variables

## Worker Deployment

### Separate Worker Process

#### Create Worker Entry Point

```typescript
// apps/server/src/workers/start-workers.ts
import { createSMSWorker } from '@repo/queue';

console.log('Starting notification workers...');

// Start SMS worker
const smsWorker = createSMSWorker();

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers gracefully...');
  try {
    await smsWorker.close();
    console.log('Workers closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  shutdown();
});

console.log('Workers started successfully');
```

#### Docker Configuration

**Dockerfile for Workers**:

```dockerfile
# Dockerfile.worker
FROM oven/bun:1 AS base

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/queue/package.json ./packages/queue/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/queue ./packages/queue
COPY apps/server ./apps/server

# Build if needed
RUN cd packages/queue && bun run build

# Start workers
CMD ["bun", "apps/server/src/workers/start-workers.ts"]
```

**Docker Compose**:

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SMS_PROVIDER=${SMS_PROVIDER}
      - SALUM_API_KEY=${SALUM_API_KEY}
      - SALUM_PARTNER_ID=${SALUM_PARTNER_ID}
    depends_on:
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=${REDIS_PASSWORD}
      - SMS_PROVIDER=${SMS_PROVIDER}
      - SALUM_API_KEY=${SALUM_API_KEY}
      - SALUM_PARTNER_ID=${SALUM_PARTNER_ID}
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

volumes:
  redis-data:
```

#### Kubernetes Deployment

**Worker Deployment**:

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-worker
  labels:
    app: notification-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-worker
  template:
    metadata:
      labels:
        app: notification-worker
    spec:
      containers:
      - name: worker
        image: your-registry/notification-worker:latest
        env:
        - name: REDIS_HOST
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: redis-host
        - name: REDIS_PORT
          value: "6379"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: password
        - name: SMS_PROVIDER
          value: "salum"
        - name: SALUM_API_KEY
          valueFrom:
            secretKeyRef:
              name: salum-secret
              key: api-key
        - name: SALUM_PARTNER_ID
          valueFrom:
            secretKeyRef:
              name: salum-secret
              key: partner-id
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "pgrep -f start-workers"
          initialDelaySeconds: 30
          periodSeconds: 10
```

**ConfigMap**:

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  redis-host: "redis-service.default.svc.cluster.local"
```

**Secrets**:

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
type: Opaque
stringData:
  password: "your-redis-password"
---
apiVersion: v1
kind: Secret
metadata:
  name: salum-secret
type: Opaque
stringData:
  api-key: "your-salum-api-key"
  partner-id: "your-partner-id"
```

### Same Process Deployment

For development or simple deployments, run workers alongside your API:

```typescript
// apps/server/src/index.ts
import { Hono } from 'hono';
import { createSMSWorker } from '@repo/queue';

const app = new Hono();

// Start worker if not in API-only mode
if (process.env.RUN_WORKERS !== 'false') {
  console.log('Starting workers in same process...');
  const worker = createSMSWorker();
  
  process.on('SIGTERM', async () => {
    await worker.close();
    process.exit(0);
  });
}

// Your API routes...
app.get('/', (c) => c.text('Hello!'));

export default app;
```

## Redis Configuration

### Production Redis Setup

#### Option 1: Managed Redis (Recommended)

Use a managed Redis service for production:

- **AWS ElastiCache**: Fully managed Redis
- **Redis Cloud**: Official Redis managed service
- **DigitalOcean Managed Redis**: Simple managed Redis
- **Upstash**: Serverless Redis

**Benefits**:
- Automatic backups
- High availability
- Monitoring included
- Automatic updates
- Scaling support

#### Option 2: Self-Hosted Redis

If self-hosting, configure Redis for production:

**redis.conf**:

```conf
# Persistence
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000

# Security
requirepass your-strong-password
bind 0.0.0.0
protected-mode yes

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
tcp-backlog 511
timeout 300
tcp-keepalive 300
```

**Docker Redis with Persistence**:

```yaml
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --appendonly yes
    --requirepass ${REDIS_PASSWORD}
    --maxmemory 2gb
    --maxmemory-policy allkeys-lru
  volumes:
    - redis-data:/data
  ports:
    - "6379:6379"
  restart: unless-stopped
```

### Redis High Availability

For critical applications, use Redis Sentinel or Cluster:

**Redis Sentinel** (for failover):

```yaml
redis-master:
  image: redis:7-alpine
  command: redis-server --requirepass ${REDIS_PASSWORD}

redis-sentinel:
  image: redis:7-alpine
  command: redis-sentinel /etc/redis/sentinel.conf
  volumes:
    - ./sentinel.conf:/etc/redis/sentinel.conf
```

**Redis Cluster** (for horizontal scaling):

```yaml
redis-cluster:
  image: redis:7-alpine
  command: redis-cli --cluster create node1:6379 node2:6379 node3:6379 --cluster-replicas 1
```

### Redis Connection Pooling

BullMQ handles connection pooling automatically, but you can configure it:

```typescript
// src/config/redis.ts
export const getRedisConnection = (): ConnectionOptions => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Connection pool settings
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  };
};
```

## Horizontal Scaling

### Scaling Workers

Workers can be scaled horizontally by running multiple instances:

**Docker Compose**:

```yaml
worker:
  build:
    context: .
    dockerfile: Dockerfile.worker
  environment:
    - REDIS_HOST=redis
  depends_on:
    - redis
  deploy:
    replicas: 5  # Run 5 worker instances
```

**Kubernetes**:

```yaml
spec:
  replicas: 5  # Run 5 worker pods
```

**Manual**:

```bash
# Terminal 1
bun src/workers/start-workers.ts

# Terminal 2
bun src/workers/start-workers.ts

# Terminal 3
bun src/workers/start-workers.ts
```

### Worker Concurrency

Adjust worker concurrency based on your needs:

```typescript
// src/config/queue-options.ts
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  limiter: {
    max: parseInt(process.env.WORKER_RATE_LIMIT_MAX || '10'),
    duration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION || '1000'),
  },
};
```

**Environment Variables**:

```bash
# Process 10 jobs concurrently per worker
WORKER_CONCURRENCY=10

# Allow 20 jobs per second per worker
WORKER_RATE_LIMIT_MAX=20
WORKER_RATE_LIMIT_DURATION=1000
```

### Scaling Calculation

Calculate required workers:

```
Required Workers = (Jobs per Second × Average Job Duration) / Worker Concurrency
```

**Example**:
- 100 jobs/second
- 2 seconds average duration
- 5 concurrency per worker

```
Required Workers = (100 × 2) / 5 = 40 workers
```

### Auto-Scaling

**Kubernetes HPA** (Horizontal Pod Autoscaler):

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: notification-worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: notification-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Monitoring and Logging

### Application Logging

Use structured logging:

```typescript
// src/workers/sms.worker.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

const processSMSJob = async (job: Job<SMSJobData>) => {
  logger.info({ jobId: job.id, type: job.data.type }, 'Processing SMS job');
  
  try {
    // Process job...
    logger.info({ jobId: job.id }, 'Job completed successfully');
  } catch (error) {
    logger.error({ jobId: job.id, error }, 'Job failed');
    throw error;
  }
};
```

### Metrics Collection

Track queue metrics:

```typescript
// src/monitoring/metrics.ts
import { smsQueue } from '../queues/sms.queue';

export async function collectQueueMetrics() {
  const counts = await smsQueue.getJobCounts();
  
  return {
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
    timestamp: new Date().toISOString()
  };
}

// Expose metrics endpoint
app.get('/metrics', async (c) => {
  const metrics = await collectQueueMetrics();
  return c.json(metrics);
});
```

### Integration with Monitoring Tools

**Prometheus**:

```typescript
import { register, Counter, Gauge } from 'prom-client';

const jobsProcessed = new Counter({
  name: 'queue_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status']
});

const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue', 'state']
});

// Update metrics
worker.on('completed', (job) => {
  jobsProcessed.inc({ queue: 'sms', status: 'completed' });
});

// Expose metrics
app.get('/metrics', async (c) => {
  return c.text(await register.metrics());
});
```

**Sentry** (Error Tracking):

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

worker.on('failed', (job, err) => {
  Sentry.captureException(err, {
    tags: {
      jobId: job?.id,
      jobType: job?.data.type,
    }
  });
});
```

## Security Best Practices

### 1. Secure Redis Connection

Use TLS for Redis connections in production:

```typescript
export const getRedisConnection = (): ConnectionOptions => {
  return {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  };
};
```

### 2. Rotate Credentials

Regularly rotate:
- Redis passwords
- SMS provider API keys
- Database credentials

### 3. Limit Network Access

- Use VPC/private networks
- Restrict Redis access to worker IPs
- Use security groups/firewall rules

### 4. Encrypt Sensitive Data

Encrypt sensitive data in job payloads:

```typescript
import { encrypt, decrypt } from './crypto';

// When creating job
const encryptedPhone = encrypt(phoneNumber);
await createOTPSMSJob({
  recipient: { phoneNumber: encryptedPhone },
  code
});

// In worker
const decryptedPhone = decrypt(job.data.recipient.phoneNumber);
```

### 5. Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
// src/config/queue-options.ts
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  limiter: {
    max: 10,      // Max 10 jobs
    duration: 1000 // Per second
  },
};
```

### 6. Job Data Validation

Validate job data before processing:

```typescript
import { z } from 'zod';

const OTPJobSchema = z.object({
  type: z.literal('otp'),
  recipient: z.object({
    phoneNumber: z.string().regex(/^\+254\d{9}$/)
  }),
  code: z.string().length(6),
  expiryMinutes: z.number().min(1).max(60)
});

const processSMSJob = async (job: Job<SMSJobData>) => {
  // Validate job data
  const validatedData = OTPJobSchema.parse(job.data);
  // Process...
};
```

## Deployment Checklist

Before deploying to production:

- [ ] Environment variables configured
- [ ] Redis configured with persistence
- [ ] Redis password set
- [ ] Workers deployed separately from API
- [ ] Graceful shutdown handlers implemented
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Rate limiting configured
- [ ] Backup strategy for Redis
- [ ] Health checks implemented
- [ ] Auto-scaling configured (if needed)
- [ ] Security review completed
- [ ] Load testing performed
- [ ] Documentation updated

## Troubleshooting Deployment Issues

See [Troubleshooting Guide](./troubleshooting.md) for common deployment issues and solutions.

## Next Steps

- Monitor your queues: [Usage Guide](./usage.md#queue-monitoring)
- Troubleshoot issues: [Troubleshooting](./troubleshooting.md)
- Optimize performance: [Architecture](./architecture.md#performance-considerations)
