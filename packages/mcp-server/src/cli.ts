#!/usr/bin/env node
/**
 * QA Guardian MCP Server CLI
 *
 * Start the MCP server from command line:
 *   npx @qa-guardian/mcp-server
 *   qa-guardian-mcp (if installed globally)
 */

import { startServer, ServerConfig } from './index';

// Parse command line arguments
function parseArgs(): Partial<ServerConfig> {
  const args = process.argv.slice(2);
  const config: Partial<ServerConfig> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--port':
      case '-p':
        config.port = parseInt(args[++i], 10);
        break;
      case '--host':
      case '-h':
        config.host = args[++i];
        break;
      case '--api-url':
        config.apiUrl = args[++i];
        break;
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--transport':
      case '-t':
        const transport = args[++i];
        if (transport === 'stdio' || transport === 'sse') {
          config.transport = transport;
        }
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      case '--version':
        printVersion();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
QA Guardian MCP Server

Usage: qa-guardian-mcp [options]

Options:
  -p, --port <port>       Port to listen on (default: 3100)
  -h, --host <host>       Host to bind to (default: localhost)
  --api-url <url>         QA Guardian API URL (default: http://localhost:3000)
  --api-key <key>         API key for authentication
  -t, --transport <type>  Transport type: stdio or sse (default: stdio)
  -v, --verbose           Enable verbose logging
  --help                  Show this help message
  --version               Show version number

Environment Variables:
  QA_GUARDIAN_API_URL     QA Guardian API URL
  QA_GUARDIAN_API_KEY     API key for authentication
  ANTHROPIC_API_KEY       Anthropic API key for Claude AI integration
  MCP_TRANSPORT           Transport type (stdio or sse)
  MCP_PORT                Port for SSE transport
  MCP_HOST                Host for SSE transport

Examples:
  npx @qa-guardian/mcp-server
  npx @qa-guardian/mcp-server --port 3100 --transport sse
  npx @qa-guardian/mcp-server --api-key your-api-key
`);
}

function printVersion(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../package.json');
  console.log(`QA Guardian MCP Server v${pkg.version}`);
}

// Main entry point
async function main(): Promise<void> {
  const cliConfig = parseArgs();

  // Merge CLI args with environment variables
  const config: ServerConfig = {
    port: cliConfig.port ?? parseInt(process.env.MCP_PORT ?? '3100', 10),
    host: cliConfig.host ?? process.env.MCP_HOST ?? 'localhost',
    apiUrl: cliConfig.apiUrl ?? process.env.QA_GUARDIAN_API_URL ?? 'http://localhost:3000',
    apiKey: cliConfig.apiKey ?? process.env.QA_GUARDIAN_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    transport: cliConfig.transport ?? (process.env.MCP_TRANSPORT as 'stdio' | 'sse') ?? 'stdio',
    verbose: cliConfig.verbose ?? process.env.MCP_VERBOSE === 'true',
  };

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   QA Guardian MCP Server                                   ║
║   Model Context Protocol Integration                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);

  console.log(`Starting MCP server...`);
  console.log(`  Transport: ${config.transport}`);
  if (config.transport === 'sse') {
    console.log(`  Host: ${config.host}`);
    console.log(`  Port: ${config.port}`);
  }
  console.log(`  API URL: ${config.apiUrl}`);
  console.log(`  API Key: ${config.apiKey ? '****' + config.apiKey.slice(-4) : '(not set)'}`);
  console.log(`  Anthropic API Key: ${config.anthropicApiKey ? '****' + config.anthropicApiKey.slice(-4) : '(not set)'}`);
  console.log('');

  try {
    await startServer(config);

    console.log(`
╔════════════════════════════════════════════════════════════╗
║  MCP Server Ready!                                         ║
╠════════════════════════════════════════════════════════════╣
${config.transport === 'sse'
  ? `║  Listening on: http://${config.host}:${config.port}                       ║`
  : `║  Using stdio transport - connect via stdin/stdout         ║`}
║                                                            ║
║  Available Tools: 90+                                      ║
║  - Test execution and management                           ║
║  - Visual regression testing                               ║
║  - Performance and load testing                            ║
║  - Accessibility testing                                   ║
║  - Security scanning                                       ║
║  - AI-powered analysis                                     ║
║                                                            ║
║  Press Ctrl+C to stop the server                           ║
╚════════════════════════════════════════════════════════════╝
`);

    // Keep the process running
    if (config.transport === 'stdio') {
      // For stdio, the server handles input/output directly
      process.stdin.resume();
    }
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down MCP server...');
  process.exit(0);
});

main();
