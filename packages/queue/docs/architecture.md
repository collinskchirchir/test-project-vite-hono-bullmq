# Architecture Documentation

This document provides a comprehensive overview of the `@repo/queue` notification system architecture, including component responsibilities, data flow, and design decisions.

## High-Level Overview

The notification queue system is built on a producer-consumer pattern where applications (producers) create jobs that are processed asynchronously by workers (consumers). This architecture enables:

- **Fast API responses**: Jobs are queued instantly and processed in the background
- **Reliability**: Failed jobs automatically retry with exponential backoff
- **Scalability**: Workers can be scaled horizontally to handle increased load
- **Flexibility**: Easy to add new notification types and templates

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Application Layer                         │
│  ┌──────────────────┐              ┌──────────────────┐        │
│  │   HonoJS API     │              │   Next.js Web    │        │
│  │   (Producer)     │              │   (Producer)     │        │
│  └────────┬─────────┘              └────────┬─────────┘        │
└───────────┼──────────────────────────────────┼──────────────────┘
            │                                  │
            │ import { createWelcomeSMSJob }   │
            │                                  │
┌───────────▼──────────────────────────────────▼──────────────────┐
│                      @repo/queue Package                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Job Creators                         │    │
│  │  • createWelcomeSMSJob()                               │    │
│  │  • createOTPSMSJob()                                   │    │
│  │  • createNotificationSMSJob()                          │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  Queue Instances                        │    │
│  │  • smsQueue (BullMQ Queue)                             │    │
│  └──────────────────────┬─────────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Redis Layer                              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              BullMQ Job Storage (Redis)                 │    │
│  │  • Job data and metadata                               │    │
│  │  • Job state (waiting, active, completed, failed)      │    │
│  │  • Retry information                                   │    │
│  └──────────────────────┬─────────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Worker Process                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   SMS Worker                            │    │
│  │  • Picks jobs from queue                               │    │
│  │  • Routes to appropriate template                      │    │
│  │  • Handles retries and errors                          │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Templates                            │    │
│  │  • renderWelcomeSMS()                                  │    │
│  │  • renderOTPSMS()                                      │    │
│  │  • renderNotificationSMS()                             │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                       │
│                         ▼                                       │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 SMS Provider                            │    │
│  │  • SalumSMSProvider (production)                       │    │
│  │  • MockSMSProvider (development)                       │    │
│  └──────────────────────┬─────────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  Salum SMS API                          │    │
│  │  • Sends actual SMS messages                           │    │
│  │  • Returns delivery status                             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### 1. Configuration Layer

**Location**: `src/config/`

**Responsibilities**:
- Manage Redis connection configuration
- Define default queue and worker options
- Provide environment-based configuration

**Key Files**:
- `redis.ts`: Redis connection configuration from environment variables
- `queue-options.ts`: Default retry policies, job retention, and worker concurrency

**Design Decision**: Centralized configuration makes it easy to adjust queue behavior without modifying multiple files.

### 2. Type System

**Location**: `src/types/`

**Responsibilities**:
- Define TypeScript interfaces for all job data
- Provide type safety across the system
- Enable discriminated unions for type narrowing

**Key Concepts**:
- `BaseJobData`: Common fields for all jobs (id, timestamp)
- `SMSJobData`: Discriminated union of all SMS job types
- `TemplateResult`: Standard output format for templates

**Design Decision**: Using discriminated unions with a `type` field enables TypeScript to narrow types in switch statements, providing compile-time safety.

### 3. Queue Layer

**Location**: `src/queues/`

**Responsibilities**:
- Create and configure BullMQ queue instances
- Provide queue instances for job creation
- Handle queue lifecycle (initialization, shutdown)

**Key Features**:
- Configured with default retry policies
- Connected to Redis
- Separate queue per notification type (SMS, email, etc.)

**Design Decision**: Separate queues per notification type allow independent scaling and monitoring.

### 4. Template Layer

**Location**: `src/templates/`

**Responsibilities**:
- Format notification messages based on job data
- Provide type-safe template functions
- Organize templates by notification type

**Structure**:
```
templates/
├── index.ts
└── sms/
    ├── index.ts
    ├── welcome.ts
    ├── otp.ts
    └── notification.ts
```

**Design Decision**: Templates are pure functions that take typed data and return formatted messages. This makes them easy to test and reuse.

### 5. Job Creation Layer

**Location**: `src/jobs/`

**Responsibilities**:
- Provide type-safe job creation functions
- Add jobs to appropriate queues
- Handle job options (priority, delay, custom ID)

**Structure**:
```
jobs/
├── index.ts
└── sms/
    ├── index.ts
    ├── welcome.job.ts
    ├── otp.job.ts
    └── notification.job.ts
```

**Design Decision**: Each template has a corresponding job creator function, making the API intuitive and discoverable.

### 6. Worker Layer

**Location**: `src/workers/`

**Responsibilities**:
- Process jobs from queues
- Route jobs to appropriate templates
- Send notifications via providers
- Handle errors and retries

**Key Features**:
- Concurrent job processing (configurable)
- Rate limiting to respect provider limits
- Event listeners for monitoring
- Graceful shutdown support

**Design Decision**: Workers use a switch statement on the job type to route to templates, leveraging TypeScript's exhaustiveness checking.

### 7. Provider Layer

**Location**: `src/providers/`

**Responsibilities**:
- Abstract SMS provider implementations
- Provide consistent interface for sending messages
- Support multiple providers (Salum, Mock, etc.)

**Structure**:
```
providers/
├── index.ts
└── sms/
    ├── index.ts
    ├── interface.ts
    ├── factory.ts
    ├── salum.provider.ts
    └── mock.provider.ts
```

**Design Decision**: Provider abstraction allows easy switching between providers and adding new ones without changing worker code.

## Data Flow

### Job Creation Flow

1. **Application calls job creator**:
   ```typescript
   createWelcomeSMSJob({ recipient, userName })
   ```

2. **Job creator constructs typed job data**:
   ```typescript
   const jobData: WelcomeSMSData = {
     type: 'welcome',
     id: crypto.randomUUID(),
     timestamp: Date.now(),
     recipient,
     userName
   }
   ```

3. **Job added to BullMQ queue**:
   ```typescript
   const job = await smsQueue.add('welcome-sms', jobData, options)
   ```

4. **BullMQ stores job in Redis**:
   - Job data serialized to JSON
   - Stored with metadata (attempts, priority, etc.)
   - Added to waiting list

5. **Function returns job ID**:
   ```typescript
   return { jobId: job.id, queueName: smsQueue.name }
   ```

### Job Processing Flow

1. **Worker picks job from Redis**:
   - BullMQ worker polls Redis for waiting jobs
   - Job moved from waiting to active state

2. **Worker routes to template**:
   ```typescript
   switch (job.data.type) {
     case 'welcome':
       templateResult = renderWelcomeSMS(job.data)
       break
     // ...
   }
   ```

3. **Template formats message**:
   ```typescript
   return {
     message: `Welcome ${data.userName}!`,
     recipient: data.recipient
   }
   ```

4. **Worker sends via provider**:
   ```typescript
   const result = await smsProvider.send(
     templateResult.recipient.phoneNumber,
     templateResult.message
   )
   ```

5. **Provider sends to external API**:
   - Salum provider calls Salum API
   - Mock provider logs to console

6. **Job marked complete or failed**:
   - Success: Job moved to completed state
   - Failure: Job retried or moved to failed state

## Design Decisions and Rationale

### 1. BullMQ over Other Queue Systems

**Decision**: Use BullMQ instead of alternatives like RabbitMQ, AWS SQS, or Kafka.

**Rationale**:
- **Simplicity**: Redis is easy to set up and manage
- **Performance**: Redis is extremely fast for queue operations
- **Features**: BullMQ provides retries, priorities, delays out of the box
- **TypeScript**: Excellent TypeScript support
- **Cost**: Redis is cheaper than managed queue services
- **Monorepo fit**: Works well in development and production

### 2. Discriminated Unions for Job Types

**Decision**: Use TypeScript discriminated unions with a `type` field.

**Rationale**:
- **Type Safety**: TypeScript can narrow types in switch statements
- **Exhaustiveness**: Compiler ensures all cases are handled
- **Discoverability**: IDE autocomplete shows all job types
- **Maintainability**: Adding new types is straightforward

### 3. Separate Queues per Notification Type

**Decision**: Create separate queues for SMS, email, etc.

**Rationale**:
- **Independent Scaling**: Scale SMS workers separately from email workers
- **Monitoring**: Track metrics per notification type
- **Rate Limiting**: Apply different limits per provider
- **Isolation**: Issues in one queue don't affect others

### 4. Template as Pure Functions

**Decision**: Templates are pure functions that take data and return formatted messages.

**Rationale**:
- **Testability**: Easy to unit test without mocking
- **Reusability**: Can be used outside of workers if needed
- **Simplicity**: No side effects or dependencies
- **Composability**: Easy to combine or extend

### 5. Provider Abstraction

**Decision**: Abstract SMS providers behind a common interface.

**Rationale**:
- **Flexibility**: Easy to switch providers
- **Testing**: Mock provider for development
- **Multi-Provider**: Could support multiple providers simultaneously
- **Vendor Independence**: Not locked into one provider

### 6. Worker Event Listeners

**Decision**: Workers emit events for job lifecycle.

**Rationale**:
- **Monitoring**: Hook into events for metrics and logging
- **Debugging**: Track job progress and failures
- **Integration**: Connect to external monitoring tools
- **Flexibility**: Add custom behavior without modifying worker

### 7. Exponential Backoff for Retries

**Decision**: Use exponential backoff (2s, 4s, 8s) for retries.

**Rationale**:
- **Provider Protection**: Avoid overwhelming SMS provider
- **Transient Failures**: Give time for temporary issues to resolve
- **Cost Efficiency**: Reduce unnecessary retry attempts
- **Industry Standard**: Common pattern for retry logic

### 8. Job Retention Policies

**Decision**: Keep completed jobs for 24 hours, failed jobs for 7 days.

**Rationale**:
- **Debugging**: Failed jobs available for investigation
- **Memory Management**: Prevent Redis from growing indefinitely
- **Audit Trail**: Recent history available for verification
- **Balance**: Trade-off between storage and utility

## Extensibility

### Adding New Notification Types

The architecture makes it easy to add new notification types (email, push, etc.):

1. Create new queue: `src/queues/email.queue.ts`
2. Create new worker: `src/workers/email.worker.ts`
3. Create templates: `src/templates/email/`
4. Create job creators: `src/jobs/email/`
5. Add types: `src/types/index.ts`
6. Export from: `src/index.ts`

**No changes needed to existing code**.

### Adding New Templates

To add a new SMS template:

1. Add type to `SMSJobData` union
2. Create template function
3. Create job creator function
4. Add case to worker switch statement
5. Export from index files

**Minimal changes, follows established patterns**.

## Performance Considerations

### Concurrency

Workers process 5 jobs concurrently by default. Adjust based on:
- Provider rate limits
- Server resources
- Job complexity

### Rate Limiting

Workers limit to 10 jobs per second by default. Configure based on:
- SMS provider limits (e.g., Salum may have rate limits)
- Cost considerations
- Business requirements

### Horizontal Scaling

Scale workers horizontally by:
- Running multiple worker processes
- Each worker processes jobs independently
- Redis coordinates job distribution
- No coordination needed between workers

### Redis Optimization

- Use Redis persistence (AOF/RDB) for durability
- Monitor Redis memory usage
- Clean old jobs regularly
- Consider Redis Cluster for high scale

## Security Considerations

### Environment Variables

- Never commit sensitive credentials
- Use `.env` files (gitignored)
- Rotate API keys regularly
- Use different keys per environment

### Redis Security

- Enable Redis authentication (`REDIS_PASSWORD`)
- Use TLS for Redis connections in production
- Restrict Redis network access
- Monitor for unauthorized access

### Data Privacy

- Avoid storing sensitive data in job metadata
- Consider encrypting phone numbers
- Implement data retention policies
- Comply with privacy regulations (GDPR, etc.)

## Monitoring and Observability

### Metrics to Track

- **Queue Metrics**: Waiting, active, completed, failed job counts
- **Worker Metrics**: Processing rate, error rate, latency
- **Provider Metrics**: Success rate, API errors, delivery status
- **System Metrics**: Redis memory, CPU usage, network I/O

### Logging Strategy

- **Job Creation**: Log job ID and type
- **Job Processing**: Log start, completion, and errors
- **Provider Calls**: Log requests and responses
- **Worker Events**: Log lifecycle events

### Alerting

Set up alerts for:
- High failure rate
- Queue backlog growing
- Worker crashes
- Provider errors
- Redis connection issues

## Future Enhancements

### Potential Improvements

1. **Job Prioritization**: More granular priority levels
2. **Scheduled Jobs**: Support for cron-like scheduling
3. **Job Dependencies**: Chain jobs together
4. **Batch Processing**: Process multiple jobs together
5. **Dead Letter Queue**: Separate queue for permanently failed jobs
6. **Metrics Dashboard**: Built-in monitoring UI
7. **Job Cancellation**: Cancel queued jobs
8. **Job Progress**: Track progress for long-running jobs

### Scalability Roadmap

1. **Phase 1** (Current): Single Redis, multiple workers
2. **Phase 2**: Redis Cluster for high availability
3. **Phase 3**: Multi-region deployment
4. **Phase 4**: Provider failover and redundancy

## Conclusion

The `@repo/queue` architecture provides a solid foundation for asynchronous notification delivery with:

- **Type Safety**: Full TypeScript support
- **Reliability**: Automatic retries and error handling
- **Scalability**: Horizontal scaling of workers
- **Extensibility**: Easy to add new types and templates
- **Maintainability**: Clear separation of concerns

The design decisions prioritize developer experience, reliability, and future growth while keeping the system simple and understandable.
