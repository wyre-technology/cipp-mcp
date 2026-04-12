# CIPP MCP Server

MCP (Model Context Protocol) server for [CIPP](https://github.com/KelvinTegelaar/CIPP) — the CyberDrain Improved Partner Portal. Provides AI assistants with structured access to CIPP's M365 multi-tenant management capabilities.

## Features

- **37 tools** across 11 categories
- Tenant, user, group, and mailbox management
- Security: Conditional Access policies, named locations
- Standards & compliance: BPA, domain health, drift detection
- License reporting (per-tenant and CSP-wide)
- Alerts, audit logs, and scheduled tasks
- GDAP role and invite management
- Stdio and HTTP transport modes
- MCP Gateway compatible

## Prerequisites

- Node.js 18+
- A running CIPP deployment
- CIPP API Key (generated from CIPP Settings → API Client Management)

## Installation

### Via npm (once published)

```sh
npx cipp-mcp
```

### From source

```sh
git clone https://github.com/wyre-technology/cipp-mcp
cd cipp-mcp
npm install
npm run build
```

## Configuration

Set these environment variables (or copy `.env.example` to `.env`):

| Variable | Required | Description |
|---|---|---|
| `CIPP_BASE_URL` | Yes | Your CIPP deployment URL (e.g. `https://cipp.yourdomain.com`) |
| `CIPP_API_KEY` | Yes | API key from CIPP Settings → API Client Management |
| `MCP_TRANSPORT` | No | `stdio` (default) or `http` |
| `MCP_HTTP_PORT` | No | Port for HTTP mode (default: 8080) |
| `LOG_LEVEL` | No | `error`, `warn`, `info` (default), or `debug` |

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cipp": {
      "command": "node",
      "args": ["/path/to/cipp-mcp/dist/entry.js"],
      "env": {
        "CIPP_BASE_URL": "https://cipp.yourdomain.com",
        "CIPP_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

| Category | Tools |
|---|---|
| Tenants | list_tenants, get_tenant_details |
| Users | list_users, create_user, edit_user, disable_user, reset_password, reset_mfa, revoke_sessions, offboard_user, bec_check, list_mfa_users, list_user_devices, list_user_groups |
| Groups | list_groups, create_group |
| Mailboxes | list_mailboxes, list_mailbox_permissions, set_out_of_office, set_email_forwarding |
| Security | list_conditional_access_policies, list_named_locations |
| Standards | list_standards, run_standards_check, list_bpa, list_domain_health |
| Licenses | list_licenses, list_csp_licenses |
| Alerts | list_audit_logs, list_alert_queue |
| GDAP | list_gdap_roles, list_gdap_invites |
| Scheduler | list_scheduled_items, add_scheduled_item |
| Core | ping, get_version, list_logs |

## Authentication Setup

1. In CIPP, go to **Settings → CIPP Settings → API Client Management**
2. Create a new API client
3. Copy the generated API key
4. Set `CIPP_API_KEY` to this value

## License

Apache-2.0 — see [LICENSE](LICENSE)

## Contributing

Issues and PRs welcome. This server is tracked against [wyre-technology/msp-claude-plugins#24](https://github.com/wyre-technology/msp-claude-plugins/issues/24).
