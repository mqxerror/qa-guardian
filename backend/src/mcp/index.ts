#!/usr/bin/env node
/**
 * QA Guardian MCP Server Entry Point
 *
 * This is the main entry point for the QA Guardian MCP server.
 * It can be run directly with: npx tsx backend/src/mcp/index.ts
 * Or after build: node dist/mcp/index.js
 */

// Load environment variables FIRST (before importing providers that read from process.env)
// This is critical for AI providers to get their API keys
import dotenv from 'dotenv';
dotenv.config();

import { MCPServer, ServerConfig, loadConfigFile } from './server';

// Parse environment variables as base config
const config: ServerConfig = {
  transport: (process.env.MCP_TRANSPORT as 'stdio' | 'sse') || 'stdio',
  apiUrl: process.env.QA_GUARDIAN_API_URL || 'http://localhost:3001',
  apiKey: process.env.QA_GUARDIAN_API_KEY,
  port: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : undefined,
  host: process.env.MCP_HOST,
  requireAuth: process.env.MCP_REQUIRE_AUTH === 'true',
  rateLimit: process.env.MCP_RATE_LIMIT ? parseInt(process.env.MCP_RATE_LIMIT, 10) : undefined,
  rateLimitWindow: process.env.MCP_RATE_LIMIT_WINDOW ? parseInt(process.env.MCP_RATE_LIMIT_WINDOW, 10) : undefined,
};

// Parse command line arguments (override env vars)
const args = process.argv.slice(2);

// First pass: look for config file
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--config' || args[i] === '-c') {
    const configPath = args[i + 1];
    if (configPath) {
      const fileConfig = loadConfigFile(configPath);
      Object.assign(config, fileConfig);
    }
    break;
  }
}

// Second pass: command line args override config file and env vars
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--config' || arg === '-c') {
    i++; // Skip config file path
  } else if (arg === '--transport' || arg === '-t') {
    const value = args[++i];
    if (value === 'stdio' || value === 'sse') {
      config.transport = value;
    }
  } else if (arg === '--port' || arg === '-p') {
    config.port = parseInt(args[++i], 10);
  } else if (arg === '--host' || arg === '-H') {
    config.host = args[++i];
  } else if (arg === '--api-url' || arg === '-u') {
    config.apiUrl = args[++i];
  } else if (arg === '--api-key' || arg === '-k') {
    config.apiKey = args[++i];
  } else if (arg === '--require-auth' || arg === '-a') {
    config.requireAuth = true;
  } else if (arg === '--rate-limit' || arg === '-r') {
    config.rateLimit = parseInt(args[++i], 10);
  } else if (arg === '--rate-limit-window' || arg === '-w') {
    config.rateLimitWindow = parseInt(args[++i], 10);
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
QA Guardian MCP Server
======================

Model Context Protocol (MCP) server for integrating QA Guardian with Claude Code.

Usage: qa-guardian-mcp [options]

Options:
  -c, --config <file>     Path to JSON config file
  -t, --transport <type>  Transport type: stdio (default) or sse
  -p, --port <port>       Port for SSE transport (default: 3000)
  -H, --host <host>       Host for SSE transport (default: 0.0.0.0)
  -u, --api-url <url>     QA Guardian API URL (default: http://localhost:3001)
  -k, --api-key <key>     API key for authentication
  -a, --require-auth      Require API key for tool calls and resource reads
  -r, --rate-limit <n>    Max requests per window (default: 100)
  -w, --rate-limit-window <s>  Rate limit window in seconds (default: 60)
  -h, --help              Show this help message

Config File Format (mcp-config.json):
  {
    "transport": "stdio",
    "apiUrl": "http://localhost:3001",
    "apiKey": "your-api-key",
    "port": 3000,
    "host": "0.0.0.0",
    "requireAuth": true,
    "rateLimit": 100,
    "rateLimitWindow": 60
  }

Environment Variables:
  MCP_TRANSPORT           Transport type (stdio|sse)
  MCP_PORT                Port for SSE transport
  MCP_HOST                Host for SSE transport
  MCP_REQUIRE_AUTH        Set to 'true' to require authentication
  MCP_RATE_LIMIT          Max requests per window (default: 100)
  MCP_RATE_LIMIT_WINDOW   Rate limit window in seconds (default: 60)
  QA_GUARDIAN_API_URL     QA Guardian API URL
  QA_GUARDIAN_API_KEY     API key for authentication

Priority (highest to lowest):
  1. Command line arguments
  2. Config file (--config)
  3. Environment variables
  4. Default values

Examples:
  # Start with stdio transport (default)
  qa-guardian-mcp

  # Start with config file
  qa-guardian-mcp --config mcp-config.json

  # Start with SSE transport on port 3000
  qa-guardian-mcp --transport sse --port 3000

  # Connect to custom API URL
  qa-guardian-mcp --api-url http://qa.example.com:3001

  # Require API key authentication
  qa-guardian-mcp --require-auth --api-key your-api-key

Claude Code Integration (stdio):
  Add this to your Claude Code configuration:

  {
    "mcpServers": {
      "qa-guardian": {
        "command": "npx",
        "args": ["tsx", "path/to/backend/src/mcp/index.ts"],
        "env": {
          "QA_GUARDIAN_API_URL": "http://localhost:3001"
        }
      }
    }
  }

Remote Use (SSE):
  Start the server with SSE transport:
    qa-guardian-mcp --transport sse --port 3000

  Connect via:
    1. GET http://localhost:3000/sse - Establish SSE connection
    2. POST http://localhost:3000/message - Send JSON-RPC requests

Available Tools:
  - list_projects       List all projects
  - get_project         Get project details
  - list_test_suites    List test suites in a project
  - run_test            Execute a test
  - get_test_results    Get test run results
  - list_recent_runs    List recent test runs
  - get_test_artifacts  Get test artifacts
  - create_test         Create a new test
`);
    process.exit(0);
  }
}

// Start the server
const server = new MCPServer(config);

server.start().catch((error) => {
  console.error('Failed to start QA Guardian MCP server:', error);
  process.exit(1);
});
