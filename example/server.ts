/**
 * Main Server Entry Point
 * Demonstrates the simplified ApplicationBootstrap API
 */

import { ApplicationBootstrap } from '../src/core/ApplicationBootstrap';
import { createConfigFromEnv } from './core/AppConfig';
// import { AutoRegistration } from '../src/core/AutoRegistration';

// // Import handlers to ensure decorators are applied during auto-discovery
// import { UserHandler } from './handlers/UserHandler';
// import { UserServiceImpl } from './services/UserService';

// // Manually register classes for auto-discovery
// AutoRegistration.registerClass(UserHandler);
// AutoRegistration.registerClass(UserServiceImpl);

async function startServer(): Promise<void> {
    const config = createConfigFromEnv();
    const bootstrap = new ApplicationBootstrap(config);

    // Start with all features enabled
    await bootstrap.start({
        verbose: true,
        enableHealthCheck: true,
        enableAutoDiscovery: true,
        enableMetrics: true,
        skipDatabaseInit: true,
        metricsIntervalMs: 5000
    });

    // Setup custom monitoring
    setupCustomMonitoring(bootstrap);
}

function setupCustomMonitoring(bootstrap: ApplicationBootstrap): void {
    // Add custom health check
    const healthService = bootstrap.getHealthCheckService();
    healthService?.addChecker('application', async () => ({
        name: 'application',
        status: 'pass',
        duration: 1,
        message: 'Application is running normally'
    }));

    // Track startup metrics
    const metricsService = bootstrap.getMetricsService();
    if (metricsService) {
        metricsService.increment('app.startup.total');
        metricsService.gauge('app.version', 1.0);
    }    // Custom cleanup on shutdown
    bootstrap.onShutdown(async () => {
        metricsService?.increment('app.shutdown.graceful');
    });
}

// ============================================================================
// APPLICATION ENTRY POINT - With graceful shutdown
// ============================================================================

if (require.main === module) {
    startServer().catch((error) => {
        console.error('💥 Fatal error during server startup:', error);
        process.exit(1);
    });

    // Note: Graceful shutdown is now handled automatically by ApplicationBootstrap
    // No need for manual SIGINT/SIGTERM handlers unless you need custom logic
}
