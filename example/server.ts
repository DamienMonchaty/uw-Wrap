// ============================================================================
// SERVER BOOTSTRAP - Simplified with ApplicationBootstrap
// ============================================================================

import { ApplicationBootstrap } from '../src/core/ApplicationBootstrap';
import { createConfigFromEnv } from './core/AppConfig';

// ============================================================================
// MAIN SERVER STARTUP - Now just 3 lines! 🎉
// ============================================================================

async function startServer(): Promise<void> {
    const config = createConfigFromEnv();
    const bootstrap = new ApplicationBootstrap(config);
    
    // All the complexity is now handled by the framework! 
    await bootstrap.start({
        schemaPath: '../schema.sql',  // Auto-detected if not specified
        verbose: false                 // Enable startup logging
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

    // Graceful shutdown handling
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        process.exit(0);
    });
}
