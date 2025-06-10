// ============================================================================
// ULTRA-SIMPLE SERVER - One-liner server startup example
// ============================================================================

import { startApplication } from '../src/core/ApplicationBootstrap';
import { createConfigFromEnv } from './core/AppConfig';

// ============================================================================
// ONE-LINER SERVER STARTUP! 🚀
// ============================================================================

// This is literally all you need for a complete uWebSockets server
// with auto-discovery, IoC, JWT auth, database, and decorators!
startApplication(createConfigFromEnv())
    .then(() => console.log('🎉 Server is running!'))
    .catch(error => {
        console.error('💥 Startup failed:', error);
        process.exit(1);
    });
