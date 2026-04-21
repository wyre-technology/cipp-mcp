# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-04-21

### Added
- Dockerfile (multi-stage node:22-alpine) for GHCR container image publishing
- docker-compose.yml with production and dev (profile-gated) services
- .dockerignore to keep image lean
- .releaserc.json for semantic-release automated versioning and GitHub releases
- GitHub Actions release workflow: test matrix (Node 18/20/22), semantic-release,
  Docker build+push to GHCR, Trivy security scan, Azure Container Apps deployment
- GitHub Actions add-to-project workflow for project board automation
- smithery.yaml for Smithery marketplace stdio configuration

## [0.1.0] - 2026-04-12

### Added
- Initial MCP server scaffold for CIPP (CyberDrain Improved Partner Portal)
- 37 tools across 11 categories: tenants, users, groups, mailboxes, security, standards, licenses, alerts, GDAP, scheduler, and core
- Bearer token authentication via CIPP_BASE_URL and CIPP_API_KEY environment variables
- Stdio and HTTP (Streamable HTTP) transport support
- MCP Gateway compatible (per-request credential injection via headers)
- Tenant management: list tenants, get tenant details
- User management: list, create, edit, disable, reset password, reset MFA, revoke sessions, offboard, BEC check
- Group management: list groups, create group
- Mailbox tools: list mailboxes, permissions, set out-of-office, set forwarding
- Security tools: list conditional access policies, named locations
- Standards tools: list standards, run compliance check, BPA results, domain health
- License tools: per-tenant and CSP-wide license reporting
- Alert tools: audit logs, alert queue
- GDAP tools: list roles and invites
- Scheduler tools: list and create scheduled tasks
- Core tools: ping, version, logs
