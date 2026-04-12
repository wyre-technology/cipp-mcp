// Configuration Utility
// Handles loading configuration from environment variables and MCP client arguments.
// Supports gateway mode where credentials come via HTTP request headers.

import { McpServerConfig } from '../types/index.js';
import { LogLevel } from './logger.js';

export type TransportType = 'stdio' | 'http';
export type AuthMode = 'env' | 'gateway';

/**
 * Fully-resolved environment configuration for the CIPP MCP server.
 * Populated by {@link loadEnvironmentConfig} and consumed by the server
 * bootstrap and the CIPP API client.
 */
export interface EnvironmentConfig {
  /** CIPP API connection details read from the environment. */
  cipp: {
    /** Base URL of the CIPP Azure Function App. */
    baseUrl?: string;
    /** Bearer token used to authenticate requests to CIPP. */
    apiKey?: string;
  };
  /** Identity information surfaced to connected MCP clients. */
  server: {
    name: string;
    version: string;
  };
  /** Transport layer settings. */
  transport: {
    /** Whether to use stdio (default) or HTTP transport. */
    type: TransportType;
    /** TCP port for the HTTP transport listener. */
    port: number;
    /** Bind address for the HTTP transport listener. */
    host: string;
  };
  /** Logging configuration. */
  logging: {
    level: LogLevel;
    format: 'json' | 'simple';
  };
  /** Authentication mode that controls how credentials are sourced. */
  auth: {
    mode: AuthMode;
  };
}

/**
 * CIPP credentials as extracted from either gateway-injected environment
 * variables or per-request HTTP headers.
 */
export interface GatewayCredentials {
  /** CIPP base URL. Maps from the `X_BASE_URL` env var or `x-base-url` header. */
  baseUrl: string | undefined;
  /** CIPP API key / Bearer token. Maps from the `X_API_KEY` env var or `x-api-key` header. */
  apiKey: string | undefined;
}

/**
 * Extract CIPP credentials from gateway-injected environment variables.
 *
 * When the MCP Gateway proxies a request it promotes HTTP headers to env vars:
 * - `X-Api-Key` header  →  `X_API_KEY` env var  (falls back to `CIPP_API_KEY`)
 * - `X-Base-Url` header →  `X_BASE_URL` env var (falls back to `CIPP_BASE_URL`)
 */
export function getCredentialsFromGateway(): GatewayCredentials {
  return {
    apiKey: process.env.X_API_KEY || process.env.CIPP_API_KEY,
    baseUrl: process.env.X_BASE_URL || process.env.CIPP_BASE_URL,
  };
}

/**
 * Parse CIPP credentials from raw HTTP request headers.
 *
 * Expected headers (case-insensitive, hyphen-separated):
 * - `x-api-key`   – CIPP Bearer token
 * - `x-base-url`  – CIPP base URL
 *
 * @param headers - The incoming request headers object (e.g. from Node's `IncomingMessage`).
 */
export function parseCredentialsFromHeaders(
  headers: Record<string, string | string[] | undefined>
): GatewayCredentials {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    apiKey: getHeader('x-api-key'),
    baseUrl: getHeader('x-base-url'),
  };
}

/**
 * Load and validate the full server configuration from environment variables.
 *
 * Recognised environment variables:
 * | Variable            | Description                                         | Default          |
 * |---------------------|-----------------------------------------------------|------------------|
 * | `CIPP_BASE_URL`     | Base URL of the CIPP Azure Function App             | –                |
 * | `CIPP_API_KEY`      | Bearer token for CIPP API authentication            | –                |
 * | `AUTH_MODE`         | `env` (default) or `gateway`                        | `env`            |
 * | `MCP_TRANSPORT`     | `stdio` (default) or `http`                         | `stdio`          |
 * | `MCP_HTTP_PORT`     | TCP port for the HTTP transport                     | `8080`           |
 * | `MCP_HTTP_HOST`     | Bind address for the HTTP transport                 | `0.0.0.0`        |
 * | `MCP_SERVER_NAME`   | Server name surfaced to MCP clients                 | `cipp-mcp`       |
 * | `MCP_SERVER_VERSION`| Server version surfaced to MCP clients              | `1.0.0`          |
 * | `LOG_LEVEL`         | Winston log level (`error`/`warn`/`info`/`debug`)   | `info`           |
 * | `LOG_FORMAT`        | Log output format (`json` or `simple`)              | `simple`         |
 *
 * @throws {Error} If `MCP_TRANSPORT` is set to an unsupported value.
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const authMode = (process.env.AUTH_MODE as AuthMode) || 'env';

  // In gateway mode the X_* env vars (injected by the gateway) take precedence.
  // In env mode we read the CIPP_* vars directly. getCredentialsFromGateway()
  // falls back to CIPP_* vars internally, so it is safe to call in both modes.
  const creds = authMode === 'gateway'
    ? getCredentialsFromGateway()
    : {
        apiKey: process.env.CIPP_API_KEY,
        baseUrl: process.env.CIPP_BASE_URL,
      };

  // Build the cipp sub-object, omitting undefined values so that
  // exactOptionalPropertyTypes is satisfied in strict tsconfig setups.
  const cippConfig: { baseUrl?: string; apiKey?: string } = {};
  if (creds.baseUrl) cippConfig.baseUrl = creds.baseUrl;
  if (creds.apiKey) cippConfig.apiKey = creds.apiKey;

  const transportType = (process.env.MCP_TRANSPORT as TransportType) || 'stdio';
  if (transportType !== 'stdio' && transportType !== 'http') {
    throw new Error(
      `Invalid MCP_TRANSPORT value: "${transportType}". Must be "stdio" or "http".`
    );
  }

  return {
    cipp: cippConfig,
    server: {
      name: process.env.MCP_SERVER_NAME || 'cipp-mcp',
      version: process.env.MCP_SERVER_VERSION || '1.0.0',
    },
    transport: {
      type: transportType,
      port: parseInt(process.env.MCP_HTTP_PORT || '8080', 10),
      host: process.env.MCP_HTTP_HOST || '0.0.0.0',
    },
    logging: {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'simple',
    },
    auth: {
      mode: authMode,
    },
  };
}

/**
 * Merge an {@link EnvironmentConfig} with optional MCP client arguments to
 * produce the final {@link McpServerConfig}.
 *
 * MCP client arguments (supplied via the MCP `initialize` handshake) override
 * the corresponding environment-derived values, allowing the same server
 * binary to serve multiple tenants without restart.
 *
 * @param envConfig - Config loaded via {@link loadEnvironmentConfig}.
 * @param mcpArgs   - Optional key/value map from the MCP client's init arguments.
 */
export function mergeWithMcpConfig(
  envConfig: EnvironmentConfig,
  mcpArgs?: Record<string, any>
): McpServerConfig {
  return {
    name: mcpArgs?.name || envConfig.server.name,
    version: mcpArgs?.version || envConfig.server.version,
    cipp: {
      baseUrl: mcpArgs?.cipp?.baseUrl || envConfig.cipp.baseUrl,
      apiKey: mcpArgs?.cipp?.apiKey || envConfig.cipp.apiKey,
    },
  };
}
