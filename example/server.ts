/**
 * Main Server Entry Point
 * Demonstrates the simplified ApplicationBootstrap API
 */

import { ApplicationBootstrap } from '../src/core/ApplicationBootstrap';
import { createConfigFromEnv } from './core/AppConfig';

async function startServer(): Promise<void> {
    const config = createConfigFromEnv();
    const bootstrap = new ApplicationBootstrap(config);

    // Start with all features enabled
    await bootstrap.start({
        verbose: true,
        enableAutoDiscovery: true
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
