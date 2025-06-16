#!/usr/bin/env node

import { MavenPackageReadmeMcpServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    const server = new MavenPackageReadmeMcpServer();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    logger.info('Starting Maven Package README MCP Server...');
    await server.run();
  } catch (error) {
    logger.error('Server failed to start', { error });
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error in main', { error });
    process.exit(1);
  });
}