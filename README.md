# my-better-t-vite-hono-bullmq

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **BullMQ** - Redis-based queue system for background jobs
- **Notification Queue System** - SMS notifications with template support
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:
```bash
bun db:push
```

## Queue System Setup

This project includes a notification queue system powered by BullMQ and Redis.

### Prerequisites

1. **Redis** - Install and run Redis locally or use a hosted service:
```bash
# macOS (using Homebrew)
brew install redis
brew services start redis

# Linux (using apt)
sudo apt-get install redis-server
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

### Configuration

1. Copy the environment example file:
```bash
cp packages/queue/.env.example .env
```

2. Configure your environment variables in `.env` or `apps/server/.env`:
```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# SMS Provider (use 'mock' for development)
SMS_PROVIDER=mock

# For production with Salum SMS provider:
# SMS_PROVIDER=salum
# SALUM_API_KEY=your-api-key
# SALUM_PARTNER_ID=your-partner-id
# SALUM_SHORTCODE=your-shortcode
```

### Starting Workers

The queue system requires background workers to process jobs. Start them with:

```bash
bun worker
```

This will start all registered workers (SMS, email, etc.) to process queued jobs.

### Queue Features

- **SMS Notifications** - Send SMS messages via configurable providers (Salum, Mock)
- **Template System** - Reusable message templates with variable substitution
- **Type Safety** - Full TypeScript support for job data and templates
- **Retry Logic** - Automatic retries with exponential backoff
- **Job Monitoring** - Track job status and handle failures
- **Multiple Providers** - Pluggable SMS provider architecture

For detailed documentation, see:
- `packages/queue/docs/usage.md` - How to use the queue system
- `packages/queue/docs/adding-templates.md` - Creating new templates
- `packages/queue/docs/deployment.md` - Production deployment guide
- `packages/queue/docs/troubleshooting.md` - Common issues and solutions


Then, run the development server:

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).







## Project Structure

```
my-better-t-vite-hono-bullmq/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono)
├── packages/
│   ├── queue/       # Notification queue system (BullMQ)
│   ├── database/    # Database schema and utilities
│   └── ui/          # Shared UI components
```

## Available Scripts

### Development
- `bun dev`: Start all applications in development mode
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun worker`: Start queue workers for background job processing

### Production
- `bun build`: Build all applications for production
- `bun start`: Start all applications in production mode
- `bun start:server`: Start only the server in production
- `bun start:web`: Start only the web application in production

### Database
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `bun db:generate`: Generate migrations
- `bun db:migrate`: Run migrations

### Code Quality
- `bun check-types`: Check TypeScript types across all apps
- `bun check`: Run Biome formatting and linting

## Development Workflow

For full-stack development with queue processing:

1. Start Redis (if not already running)
2. Run `bun dev` to start web and server
3. In a separate terminal, run `bun worker` to process background jobs
4. Access the web app at http://localhost:3001
5. API available at http://localhost:3000

## Queue System Usage

Send an SMS notification from your code:

```typescript
import { addSMSJob } from '@repo/queue';

// Using a template
await addSMSJob('welcome', {
  phoneNumber: '+254712345678',
  data: { name: 'John Doe' }
});

// Custom message
await addSMSJob('custom', {
  phoneNumber: '+254712345678',
  message: 'Your custom message here'
});
```

Check the queue documentation in `packages/queue/docs/` for more examples.

## Production Deployment

This monorepo uses Turborepo for efficient builds and can be deployed in several ways:

### Build for Production

```bash
bun install
bun build
```

This builds all apps and packages. The output will be in:
- `apps/server/dist/` - Server build
- `apps/web/dist/` - Web build (static files)

### Running in Production

You have several deployment options:

#### Option 1: Single Server (All-in-One)

Run everything on one server with separate processes:

```bash
# Terminal 1: Start the API server
bun start:server

# Terminal 2: Start the queue workers
cd apps/server && bun worker:prod

# Terminal 3: Serve the web app (or use a CDN)
cd apps/web && bun serve
```

#### Option 2: Separate Services (Recommended)

Deploy each component independently:

1. **API Server**: Deploy `apps/server` to a Node.js hosting service
   - Run: `bun start` or `bun run dist/index.js`
   - Requires: PostgreSQL, Redis connections

2. **Queue Workers**: Deploy as a separate service or background job
   - Run: `bun worker:prod` or `bun run dist/workers/start-workers.js`
   - Requires: Redis connection
   - Can scale independently (multiple worker instances)

3. **Web App**: Deploy static files from `apps/web/dist` to:
   - Vercel, Netlify, Cloudflare Pages
   - Or any static hosting / CDN

#### Option 3: Docker (Coming Soon)

Docker Compose configuration for containerized deployment.

### Production Checklist

- [ ] Set `NODE_ENV=production` in environment variables
- [ ] Configure production database (PostgreSQL)
- [ ] Set up Redis (managed service recommended)
- [ ] Configure SMS provider credentials (if using Salum)
- [ ] Set strong passwords for Redis and database
- [ ] Enable Redis persistence (AOF/RDB)
- [ ] Set up monitoring for queue jobs
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up log aggregation
- [ ] Configure CORS for API
- [ ] Use HTTPS for all services
- [ ] Set up database backups
- [ ] Configure rate limiting

### Scaling Considerations

**API Server**: 
- Stateless, can run multiple instances behind a load balancer
- Shares Redis and PostgreSQL connections

**Queue Workers**:
- Can run multiple instances for parallel job processing
- BullMQ handles job distribution automatically
- Scale based on queue depth and job processing time

**Redis**:
- Use Redis Cluster for high availability
- Consider managed services (AWS ElastiCache, Redis Cloud)
- Monitor memory usage and connection count

For detailed deployment strategies, see `packages/queue/docs/deployment.md`.
