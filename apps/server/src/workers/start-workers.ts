/**
 * Worker Startup Script
 * 
 * This script initializes and starts all notification workers.
 * It should be run as a separate process from the API server for production deployments.
 * 
 * Usage:
 *   bun run apps/server/src/workers/start-workers.ts
 */

import { createSMSWorker, closeSMSWorker } from '@repo/queue';

// Store worker instances for graceful shutdown
let smsWorker: ReturnType<typeof createSMSWorker> | null = null;

/**
 * Initialize and start all workers
 */
const startWorkers = async () => {
    console.log('🚀 Starting notification workers...');

    try {
        // Initialize SMS worker
        console.log('📱 Initializing SMS worker...');
        smsWorker = createSMSWorker();
        console.log('✅ SMS worker started successfully');

        console.log('✨ All workers are running and ready to process jobs');
    } catch (error) {
        console.error('❌ Failed to start workers:', error);
        process.exit(1);
    }
};

/**
 * Gracefully shutdown all workers
 */
const shutdownWorkers = async () => {
    console.log('\n🛑 Shutting down workers gracefully...');

    try {
        if (smsWorker) {
            console.log('📱 Closing SMS worker...');
            await closeSMSWorker(smsWorker);
            console.log('✅ SMS worker closed');
        }

        console.log('✨ All workers shut down successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown signals
process.on('SIGTERM', () => {
    console.log('📨 Received SIGTERM signal');
    shutdownWorkers();
});

process.on('SIGINT', () => {
    console.log('📨 Received SIGINT signal');
    shutdownWorkers();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    shutdownWorkers();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    shutdownWorkers();
});

// Start the workers
startWorkers();
