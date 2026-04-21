// OAuth token provider for the CIPP API.
//
// CIPP's API clients (Settings → Integrations → CIPP-API) are Entra app
// registrations. Callers authenticate via the OAuth 2.0 client-credentials
// flow and pass the resulting access token as a Bearer to /api/*.
//
// This provider performs that exchange and caches tokens until just before
// their expiry, so the MCP server can simply ask for a fresh token on each
// request without hammering the /oauth2/v2.0/token endpoint.

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../utils/logger.js';

/** Credentials needed to run the client-credentials flow against Entra ID. */
export interface TokenProviderConfig {
  /** Entra tenant (directory) ID that owns the API-client app registration. */
  tenantId: string;
  /** Application (client) ID of the CIPP API client. */
  clientId: string;
  /** Application secret value issued for the CIPP API client. */
  clientSecret: string;
  /**
   * OAuth scope to request. Typically the CIPP-SAM application's
   * `api://<sam-app-id>/.default`. Defaults to `<clientId>/.default`, which
   * is correct when the CIPP-API integration page lists the API client as
   * its own resource. Override when CIPP displays a different scope.
   */
  scope?: string;
  /**
   * Full token endpoint URL. Defaults to
   * `https://login.microsoftonline.com/<tenantId>/oauth2/v2.0/token`.
   * Override only to target sovereign clouds or a custom STS.
   */
  tokenUrl?: string;
}

interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds at which the token should be considered expired. */
  expiresAt: number;
}

/** Refresh tokens this many milliseconds before their nominal expiry. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Acquires and caches CIPP API access tokens via the Entra ID
 * client-credentials flow.
 */
export class TokenProvider {
  private readonly config: Required<Pick<TokenProviderConfig, 'tenantId' | 'clientId' | 'clientSecret'>> &
    Pick<TokenProviderConfig, 'scope' | 'tokenUrl'>;
  private readonly logger: Logger;
  private cache: CachedToken | undefined;
  private inflight: Promise<string> | undefined;

  constructor(config: TokenProviderConfig, logger: Logger) {
    if (!config.tenantId) {
      throw new Error('TokenProvider: tenantId is required');
    }
    if (!config.clientId) {
      throw new Error('TokenProvider: clientId is required');
    }
    if (!config.clientSecret) {
      throw new Error('TokenProvider: clientSecret is required');
    }
    this.config = config;
    this.logger = logger;
  }

  /**
   * Return a valid access token, acquiring or refreshing as needed.
   * Concurrent callers share a single in-flight request.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAt - TOKEN_REFRESH_SKEW_MS) {
      return this.cache.accessToken;
    }
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.fetchToken().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private get tokenUrl(): string {
    return (
      this.config.tokenUrl ||
      `https://login.microsoftonline.com/${encodeURIComponent(this.config.tenantId)}/oauth2/v2.0/token`
    );
  }

  private get scope(): string {
    return this.config.scope || `${this.config.clientId}/.default`;
  }

  private async fetchToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: this.scope,
    });

    this.logger.debug('Requesting CIPP access token', {
      tokenUrl: this.tokenUrl,
      scope: this.scope,
      clientId: this.config.clientId,
    });

    let response: Response;
    try {
      response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(
        ErrorCode.InternalError,
        `Network error obtaining CIPP access token from ${this.tokenUrl}: ${message}`
      );
    }

    const rawBody = await response.text();
    if (!response.ok) {
      this.logger.error('CIPP token endpoint returned error', {
        status: response.status,
        body: rawBody,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `CIPP token endpoint returned HTTP ${response.status}: ${rawBody}`
      );
    }

    let parsed: { access_token?: string; expires_in?: number };
    try {
      parsed = JSON.parse(rawBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to parse CIPP token response as JSON: ${message}`
      );
    }

    if (!parsed.access_token) {
      throw new McpError(
        ErrorCode.InternalError,
        'CIPP token response did not include an access_token field'
      );
    }

    const expiresInMs = (parsed.expires_in ?? 3600) * 1000;
    this.cache = {
      accessToken: parsed.access_token,
      expiresAt: Date.now() + expiresInMs,
    };
    this.logger.debug('CIPP access token cached', {
      expiresInSeconds: parsed.expires_in,
    });
    return parsed.access_token;
  }
}
