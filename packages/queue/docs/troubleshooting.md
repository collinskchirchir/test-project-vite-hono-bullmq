# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the notification queue system.

## Table of Contents

- [Redis Connection Issues](#redis-connection-issues)
- [Worker Issues](#worker-issues)
- [Job Failures](#job-failures)
- [Performance Issues](#performance-issues)
- [SMS Provider Issues](#sms-provider-issues)
- [Debugging Techniques](#debugging-techniques)
- [FAQ](#faq)

## Redis Connection Issues

### Issue: Connection Refused

**Symptoms**:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Causes**:
1. Redis is not running
2. Wrong host/port configuration
3. Firewall blocking connection

**Solutions**:

1. **Check if Redis is running**:
```bash
redis-cli ping
# Should return: PONG
```

2. **Start Redis**:
```bash
# macOS (Homebrew)
brew services start redis

# Linux (systemd)
sudo systemctl start redis-server

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

3. **Verify environment variables**:
```bash
echo $REDIS_HOST
echo $REDIS_PORT
```

4. **Test connection manually**:
```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

### Issue: Authentication Failed

**Symptoms**:
```
Error: NOAUTH Authentication required
```

**Causes**:
1. Redis requires password but none provided
2. Wrong password in environment variables

**Solutions**:

1. **Set Redis password**:
```bash
export REDIS_PASSWORD=your-password
```

2. **Test with password**:
```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD ping
```

3. **Check Redis configuration**:
```bash
redis-cli CONFIG GET requirepass
```

### Issue: Connection Timeout

**Symptoms**:
```
Error: Connection timeout
```

**Causes**:
1. Network issues
2. Redis overloaded
3. Firewall rules

**Solutions**:

1. **Check network connectivity**:
```bash
ping $REDIS_HOST
telnet $REDIS_HOST $REDIS_PORT
```

2. **Check Redis load**:
```bash
redis-cli INFO stats
redis-cli INFO clients
```

3. **Increase timeout**:
```typescript
// src/config/redis.ts
export const getRedisConnection = (): ConnectionOptions => {
  return {
    // ...
    connectTimeout: 30000, // 30 seconds
    retryStrategy: (times: number) => {
      return Math.min(times * 100, 3000);
    },
  };
};
```

### Issue: Too Many Connections

**Symptoms**:
```
Error: ERR max number of clients reached
```

**Causes**:
1. Too many workers/connections
2. Connection leak
3. Redis maxclients limit too low

**Solutions**:

1. **Check current connections**:
```bash
redis-cli CLIENT LIST | wc -l
```

2. **Increase Redis maxclients**:
```bash
redis-cli CONFIG SET maxclients 10000
```

3. **Close unused connections**:
```typescript
// Ensure proper cleanup
await smsQueue.close();
await worker.close();
```

## Worker Issues

### Issue: Worker Not Processing Jobs

**Symptoms**:
- Jobs stuck in "waiting" state
- Worker running but no activity

**Causes**:
1. Worker not started
2. Worker crashed
3. Queue paused
4. Redis connection issue

**Solutions**:

1. **Check worker is running**:
```bash
ps aux | grep start-workers
```

2. **Check worker logs**:
```bash
# Docker
docker logs worker-container

# Kubernetes
kubectl logs deployment/notification-worker
```

3. **Check queue status**:
```typescript
import { smsQueue } from '@repo/queue';

const isPaused = await smsQueue.isPaused();
console.log('Queue paused:', isPaused);

if (isPaused) {
  await smsQueue.resume();
}
```

4. **Check job counts**:
```typescript
const counts = await smsQueue.getJobCounts();
console.log(counts);
// { waiting: 10, active: 0, completed: 5, failed: 2 }
```

5. **Restart worker**:
```bash
# Docker
docker restart worker-container

# Kubernetes
kubectl rollout restart deployment/notification-worker

# Manual
pkill -f start-workers
bun src/workers/start-workers.ts
```

### Issue: Worker Crashes

**Symptoms**:
- Worker process exits unexpectedly
- Jobs fail with no error message

**Causes**:
1. Unhandled exceptions
2. Memory issues
3. Redis connection lost

**Solutions**:

1. **Add error handlers**:
```typescript
// src/workers/start-workers.ts
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Log to error tracking service
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection:', reason);
  // Log to error tracking service
  process.exit(1);
});
```

2. **Monitor memory usage**:
```bash
# Check memory
ps aux | grep start-workers

# Docker
docker stats worker-container
```

3. **Increase memory limit**:
```yaml
# docker-compose.yml
worker:
  deploy:
    resources:
      limits:
        memory: 1G
```

4. **Add health checks**:
```typescript
// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});
```

### Issue: Worker Processing Slowly

**Symptoms**:
- Jobs taking longer than expected
- Queue backlog growing

**Causes**:
1. Low concurrency
2. Slow SMS provider
3. Network issues
4. Insufficient workers

**Solutions**:

1. **Increase concurrency**:
```typescript
// src/config/queue-options.ts
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 10, // Increase from 5 to 10
};
```

2. **Add more workers**:
```yaml
# docker-compose.yml
worker:
  deploy:
    replicas: 5  # Scale to 5 instances
```

3. **Check provider response time**:
```typescript
const start = Date.now();
const result = await smsProvider.send(phone, message);
const duration = Date.now() - start;
console.log(`Provider took ${duration}ms`);
```

4. **Monitor queue metrics**:
```typescript
setInterval(async () => {
  const counts = await smsQueue.getJobCounts();
  console.log('Queue status:', counts);
}, 10000); // Every 10 seconds
```

## Job Failures

### Issue: Jobs Failing Immediately

**Symptoms**:
```
SMS job 123 failed: [error message]
```

**Causes**:
1. Invalid job data
2. Template error
3. Provider configuration issue

**Solutions**:

1. **Check job data**:
```typescript
const job = await smsQueue.getJob('job-id');
console.log('Job data:', job?.data);
```

2. **Test template directly**:
```typescript
import { renderWelcomeSMS } from '@repo/queue';

try {
  const result = renderWelcomeSMS({
    type: 'welcome',
    id: 'test',
    timestamp: Date.now(),
    recipient: { phoneNumber: '+254712345678' },
    userName: 'Test'
  });
  console.log('Template result:', result);
} catch (error) {
  console.error('Template error:', error);
}
```

3. **Check provider configuration**:
```bash
echo $SMS_PROVIDER
echo $SALUM_API_KEY
echo $SALUM_PARTNER_ID
```

4. **Test provider directly**:
```typescript
import { createSMSProvider } from '@repo/queue';

const provider = createSMSProvider();
const result = await provider.send('+254712345678', 'Test message');
console.log('Provider result:', result);
```

### Issue: Jobs Failing After Retries

**Symptoms**:
- Jobs fail after 3 attempts
- Same error each time

**Causes**:
1. Persistent provider issue
2. Invalid phone number
3. Rate limiting

**Solutions**:

1. **Check failed jobs**:
```typescript
const failedJobs = await smsQueue.getFailed(0, 10);
for (const job of failedJobs) {
  console.log('Job:', job.id);
  console.log('Data:', job.data);
  console.log('Error:', job.failedReason);
  console.log('Attempts:', job.attemptsMade);
}
```

2. **Validate phone numbers**:
```typescript
const phoneRegex = /^\+254\d{9}$/;
if (!phoneRegex.test(phoneNumber)) {
  throw new Error('Invalid phone number format');
}
```

3. **Check rate limits**:
```typescript
// Reduce rate limit
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  limiter: {
    max: 5,      // Reduce from 10 to 5
    duration: 1000
  },
};
```

4. **Manually retry failed jobs**:
```typescript
const failedJobs = await smsQueue.getFailed();
for (const job of failedJobs) {
  await job.retry();
}
```

### Issue: Jobs Stuck in Active State

**Symptoms**:
- Jobs show as "active" but never complete
- Worker appears frozen

**Causes**:
1. Worker crashed mid-processing
2. Long-running job
3. Deadlock

**Solutions**:

1. **Check active jobs**:
```typescript
const activeJobs = await smsQueue.getActive();
console.log('Active jobs:', activeJobs.length);
for (const job of activeJobs) {
  console.log('Job:', job.id, 'Started:', new Date(job.processedOn || 0));
}
```

2. **Move stuck jobs back to waiting**:
```typescript
// BullMQ will automatically move stalled jobs
// Configure stalled check interval
const worker = new Worker(QUEUE_NAME, processJob, {
  stalledInterval: 30000, // Check every 30 seconds
  maxStalledCount: 2,     // Move to failed after 2 stalls
});
```

3. **Restart worker**:
```bash
# This will release active jobs
docker restart worker-container
```

## Performance Issues

### Issue: High Memory Usage

**Symptoms**:
- Worker memory growing over time
- Out of memory errors

**Causes**:
1. Memory leak
2. Too many completed jobs in Redis
3. Large job payloads

**Solutions**:

1. **Clean old jobs regularly**:
```typescript
// Run daily
setInterval(async () => {
  await smsQueue.clean(24 * 3600 * 1000, 1000, 'completed');
  await smsQueue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
}, 24 * 60 * 60 * 1000);
```

2. **Reduce job retention**:
```typescript
export const defaultQueueOptions: QueueOptions = {
  defaultJobOptions: {
    removeOnComplete: {
      age: 3600,  // 1 hour instead of 24
      count: 100  // Keep last 100 instead of 1000
    },
  },
};
```

3. **Monitor Redis memory**:
```bash
redis-cli INFO memory
```

4. **Set Redis maxmemory**:
```bash
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Issue: High CPU Usage

**Symptoms**:
- Worker using 100% CPU
- System slow

**Causes**:
1. Too high concurrency
2. Tight polling loop
3. Inefficient template code

**Solutions**:

1. **Reduce concurrency**:
```typescript
export const defaultWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 3, // Reduce from 5
};
```

2. **Add delays between jobs**:
```typescript
const worker = new Worker(QUEUE_NAME, processJob, {
  ...defaultWorkerOptions,
  limiter: {
    max: 5,
    duration: 1000, // Process max 5 per second
  },
});
```

3. **Profile template code**:
```typescript
const start = Date.now();
const result = renderWelcomeSMS(data);
const duration = Date.now() - start;
if (duration > 100) {
  console.warn(`Template took ${duration}ms`);
}
```

### Issue: Redis Running Out of Memory

**Symptoms**:
```
Error: OOM command not allowed when used memory > 'maxmemory'
```

**Causes**:
1. Too many jobs stored
2. Large job payloads
3. No eviction policy

**Solutions**:

1. **Set eviction policy**:
```bash
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

2. **Clean old jobs**:
```typescript
await smsQueue.clean(0, 0, 'completed');
await smsQueue.clean(0, 0, 'failed');
```

3. **Reduce job payload size**:
```typescript
// Instead of storing full user object
await createWelcomeSMSJob({
  recipient: { phoneNumber: user.phone },
  userName: user.name  // Only what's needed
});
```

4. **Increase Redis memory**:
```bash
redis-cli CONFIG SET maxmemory 4gb
```

## SMS Provider Issues

### Issue: Salum API Errors

**Symptoms**:
```
SMS send failed: HTTP error! status: 401
```

**Causes**:
1. Invalid API key
2. Invalid partner ID
3. Network issues
4. API rate limiting

**Solutions**:

1. **Verify credentials**:
```bash
echo $SALUM_API_KEY
echo $SALUM_PARTNER_ID
```

2. **Test API directly**:
```bash
curl -X POST https://sms.salum.co.ke/api/services/sendsms/ \
  -H "Content-Type: application/json" \
  -d '{
    "apikey": "your-api-key",
    "partnerID": "your-partner-id",
    "message": "Test",
    "shortcode": "TEST",
    "mobile": "254712345678"
  }'
```

3. **Check API response**:
```typescript
// Add detailed logging in provider
console.log('Salum request:', requestBody);
console.log('Salum response:', await response.text());
```

4. **Use mock provider for testing**:
```bash
SMS_PROVIDER=mock
```

### Issue: Phone Number Format Errors

**Symptoms**:
```
SMS send failed: Invalid phone number
```

**Causes**:
1. Wrong format (not 254XXXXXXXXX)
2. Invalid country code
3. Too short/long

**Solutions**:

1. **Validate phone numbers**:
```typescript
function validateKenyanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^(\+?254|0)?[17]\d{8}$/.test(cleaned);
}
```

2. **Normalize phone numbers**:
```typescript
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.substring(1);
  if (!cleaned.startsWith('254')) cleaned = '254' + cleaned;
  return cleaned;
}
```

3. **Test normalization**:
```typescript
console.log(normalizePhone('0712345678'));    // 254712345678
console.log(normalizePhone('+254712345678')); // 254712345678
console.log(normalizePhone('712345678'));     // 254712345678
```

## Debugging Techniques

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=debug

# BullMQ debug logs
export DEBUG=bull*
```

### Inspect Queue State

```typescript
import { smsQueue } from '@repo/queue';

// Get all job states
const counts = await smsQueue.getJobCounts();
console.log('Job counts:', counts);

// Get specific jobs
const waiting = await smsQueue.getWaiting(0, 10);
const active = await smsQueue.getActive(0, 10);
const failed = await smsQueue.getFailed(0, 10);

console.log('Waiting:', waiting.map(j => j.id));
console.log('Active:', active.map(j => j.id));
console.log('Failed:', failed.map(j => ({ id: j.id, error: j.failedReason })));
```

### Monitor Queue Events

```typescript
smsQueue.on('waiting', (jobId) => {
  console.log(`Job ${jobId} is waiting`);
});

smsQueue.on('active', (job) => {
  console.log(`Job ${job.id} started processing`);
});

smsQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

smsQueue.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed:`, err.message);
});

smsQueue.on('error', (err) => {
  console.error('Queue error:', err);
});
```

### Test Individual Components

```typescript
// Test template
import { renderWelcomeSMS } from '@repo/queue';
const result = renderWelcomeSMS(testData);
console.log(result);

// Test provider
import { createSMSProvider } from '@repo/queue';
const provider = createSMSProvider();
const result = await provider.send('+254712345678', 'Test');
console.log(result);

// Test job creation
import { createWelcomeSMSJob } from '@repo/queue';
const result = await createWelcomeSMSJob(testParams);
console.log(result);
```

### Use Redis CLI

```bash
# List all keys
redis-cli KEYS "bull:sms-notifications:*"

# Get job data
redis-cli GET "bull:sms-notifications:123"

# Monitor Redis commands
redis-cli MONITOR

# Check queue length
redis-cli LLEN "bull:sms-notifications:wait"
```

## FAQ

### Q: How do I clear all jobs from a queue?

```typescript
await smsQueue.obliterate({ force: true });
```

### Q: How do I pause job processing?

```typescript
await smsQueue.pause();
// Resume later
await smsQueue.resume();
```

### Q: How do I change job priority after creation?

```typescript
const job = await smsQueue.getJob('job-id');
if (job) {
  await job.changePriority({ priority: 1 });
}
```

### Q: How do I get job progress?

```typescript
const job = await smsQueue.getJob('job-id');
const state = await job.getState();
console.log('Job state:', state);
console.log('Progress:', job.progress);
```

### Q: How do I prevent duplicate jobs?

Use custom job IDs:

```typescript
await createWelcomeSMSJob(params, {
  jobId: `welcome-${userId}`
});
```

### Q: How do I delay a job?

```typescript
await createWelcomeSMSJob(params, {
  delay: 60000 // 1 minute in milliseconds
});
```

### Q: How do I retry a specific failed job?

```typescript
const job = await smsQueue.getJob('job-id');
if (job) {
  await job.retry();
}
```

### Q: How do I see why a job failed?

```typescript
const job = await smsQueue.getJob('job-id');
console.log('Failed reason:', job?.failedReason);
console.log('Stack trace:', job?.stacktrace);
console.log('Attempts:', job?.attemptsMade);
```

### Q: How do I change retry settings for a specific job?

```typescript
await createOTPSMSJob(params, {
  attempts: 5,  // Override default 3 attempts
  backoff: {
    type: 'exponential',
    delay: 5000  // Start with 5 seconds
  }
});
```

### Q: How do I monitor queue health?

```typescript
// Create health check endpoint
app.get('/health/queue', async (c) => {
  try {
    const counts = await smsQueue.getJobCounts();
    const isPaused = await smsQueue.isPaused();
    
    const isHealthy = 
      !isPaused &&
      counts.failed < 100 &&
      counts.waiting < 1000;
    
    return c.json({
      healthy: isHealthy,
      paused: isPaused,
      counts
    }, isHealthy ? 200 : 503);
  } catch (error) {
    return c.json({ healthy: false, error }, 503);
  }
});
```

## Getting Help

If you're still experiencing issues:

1. Check the [Architecture Documentation](./architecture.md) for system design
2. Review [Usage Examples](./usage.md) for correct usage patterns
3. Check [Deployment Guide](./deployment.md) for configuration
4. Enable debug logging and collect logs
5. Check Redis and worker logs
6. Create an issue with:
   - Error messages
   - Environment details
   - Steps to reproduce
   - Relevant logs

## Performance Optimization Tips

1. **Adjust concurrency** based on your workload
2. **Clean old jobs** regularly to free Redis memory
3. **Use appropriate priorities** for different job types
4. **Monitor queue metrics** to identify bottlenecks
5. **Scale workers horizontally** for high throughput
6. **Use Redis persistence** for job durability
7. **Implement rate limiting** to respect provider limits
8. **Cache provider connections** when possible
9. **Batch similar jobs** when appropriate
10. **Profile slow templates** and optimize them
