#!/usr/bin/env node
// Main Entry Point for CIPP MCP Server

import { CippMcpServer } from './mcp/server.js';
import { Logger } from './utils/logger.js';
import { loadEnvironmentConfig, mergeWithMcpConfig } from './utils/config.js';

async function main() {
  let logger: Logger | undefined;
  try {
    const envConfig = loadEnvironmentConfig();
    const mcpConfig = mergeWithMcpConfig(envConfig);
    logger = new Logger(envConfig.logging.level, envConfig.logging.format);
    logger.info('Starting CIPP MCP Server...');

    const hasOAuth = !!(mcpConfig.cipp.tenantId && mcpConfig.cipp.clientId && mcpConfig.cipp.clientSecret);
    const hasStatic = !!mcpConfig.cipp.apiKey;
    if (!mcpConfig.cipp.baseUrl || (!hasStatic && !hasOAuth)) {
      logger.warn(
        'Missing CIPP credentials. Tools will return errors until CIPP_BASE_URL plus either CIPP_API_KEY or (CIPP_TENANT_ID + CIPP_CLIENT_ID + CIPP_CLIENT_SECRET) are configured.'
      );
    }

    const server = new CippMcpServer(mcpConfig, logger, envConfig);

    process.on('SIGINT', async () => { logger!.info('Received SIGINT, shutting down...'); await server.stop(); process.exit(0); });
    process.on('SIGTERM', async () => { logger!.info('Received SIGTERM, shutting down...'); await server.stop(); process.exit(0); });

    await server.start();
  } catch (error) {
    if (logger) { logger.error('Failed to start CIPP MCP Server:', error); }
    else { console.error('Failed to start CIPP MCP Server:', error); }
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); process.exit(1); });
process.on('uncaughtException', (error) => { console.error('Uncaught Exception:', error); process.exit(1); });

main().catch((error) => { console.error('Failed to start server:', error); process.exit(1); });
