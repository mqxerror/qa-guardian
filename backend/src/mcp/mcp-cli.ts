/**
 * MCP Server CLI Module
 *
 * Handles command-line argument parsing, config file loading, and the main entry point.
 *
 * Feature #1356: Extracted from server.ts to reduce file size
 *
 * @module mcp-cli
 */

import * as fs from 'fs';
import * as path from 'path';
import { MCPServer } from './server.js';
import type { ServerConfig } from './mcp-types.js';

/**
 * Load configuration from a JSON file
 *
 * @param configPath - Path to the JSON configuration file
 * @returns Partial server configuration from the file
 */
export function loadConfigFile(configPath: string): Partial<ServerConfig> {
  try {
    const absolutePath = path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath);

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const fileConfig = JSON.parse(content);

    const config: Partial<ServerConfig> = {};

    if (fileConfig.transport === 'stdio' || fileConfig.transport === 'sse') {
      config.transport = fileConfig.transport;
    }
    if (typeof fileConfig.port === 'number') {
      config.port = fileConfig.port;
    }
    if (typeof fileConfig.host === 'string') {
      config.host = fileConfig.host;
    }
    if (typeof fileConfig.apiUrl === 'string') {
      config.apiUrl = fileConfig.apiUrl;
    }
    if (typeof fileConfig.apiKey === 'string') {
      config.apiKey = fileConfig.apiKey;
    }
    if (typeof fileConfig.requireAuth === 'boolean') {
      config.requireAuth = fileConfig.requireAuth;
    }
    if (typeof fileConfig.rateLimit === 'number') {
      config.rateLimit = fileConfig.rateLimit;
    }
    if (typeof fileConfig.rateLimitWindow === 'number') {
      config.rateLimitWindow = fileConfig.rateLimitWindow;
    }

    // Feature #854: Streaming configuration from config file
    if (typeof fileConfig.enableStreaming === 'boolean') {
      config.enableStreaming = fileConfig.enableStreaming;
    }
    if (typeof fileConfig.streamChunkSize === 'number') {
      config.streamChunkSize = fileConfig.streamChunkSize;
    }
    if (typeof fileConfig.streamThreshold === 'number') {
      config.streamThreshold = fileConfig.streamThreshold;
    }

    // Feature #855: Webhook callback configuration from config file
    if (typeof fileConfig.enableWebhookCallbacks === 'boolean') {
      config.enableWebhookCallbacks = fileConfig.enableWebhookCallbacks;
    }
    if (fileConfig.webhookCallback && typeof fileConfig.webhookCallback === 'object') {
      const webhook = fileConfig.webhookCallback as Record<string, unknown>;
      if (typeof webhook.url === 'string') {
        try {
          new URL(webhook.url);
          config.webhookCallback = {
            url: webhook.url,
            method: (webhook.method as 'POST' | 'PUT') || 'POST',
            headers: webhook.headers as Record<string, string>,
            includeRequestParams: webhook.includeRequestParams as boolean,
            retries: webhook.retries as number,
            timeout: webhook.timeout as number,
            secret: webhook.secret as string,
          };
        } catch {
          console.error('[QA Guardian MCP] Invalid webhook callback URL in config');
        }
      }
    }

    console.error(`[QA Guardian MCP] Loaded config from: ${absolutePath}`);
    return config;
  } catch (error) {
    console.error(`[QA Guardian MCP] Error loading config file: ${error instanceof Error ? error.message : error}`);
    return {};
  }
}

/**
 * Parse command line arguments into server configuration
 *
 * @returns Server configuration parsed from CLI args
 */
export function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    transport: 'stdio',
  };

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

  // Second pass: command line args override config file
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
    } else if (arg === '--tool-timeout' || arg === '-T') {
      config.toolTimeout = parseInt(args[++i], 10);
    } else if (arg === '--enable-streaming') {
      config.enableStreaming = true;
    } else if (arg === '--disable-streaming') {
      config.enableStreaming = false;
    } else if (arg === '--stream-chunk-size') {
      config.streamChunkSize = parseInt(args[++i], 10);
    } else if (arg === '--stream-threshold') {
      config.streamThreshold = parseInt(args[++i], 10);
    } else if (arg === '--webhook-callback') {
      const url = args[++i];
      try {
        new URL(url);
        config.webhookCallback = { url };
      } catch {
        console.error(`[QA Guardian MCP] Invalid webhook callback URL: ${url}`);
      }
    } else if (arg === '--enable-webhook-callbacks') {
      config.enableWebhookCallbacks = true;
    } else if (arg === '--disable-webhook-callbacks') {
      config.enableWebhookCallbacks = false;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return config;
}

/**
 * Print CLI help message
 */
function printHelp(): void {
  console.log(`
QA Guardian MCP Server

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
  -T, --tool-timeout <ms>  Tool execution timeout in milliseconds (default: 30000)
  --enable-streaming       Enable response streaming for large results (default: true)
  --disable-streaming      Disable response streaming
  --stream-chunk-size <n>  Items per streaming chunk (default: 10)
  --stream-threshold <n>   Min items to trigger streaming (default: 20)
  --webhook-callback <url> Global webhook callback URL for operation completion
  --enable-webhook-callbacks   Enable per-request webhook callbacks (default: true)
  --disable-webhook-callbacks  Disable per-request webhook callbacks
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
    "rateLimitWindow": 60,
    "toolTimeout": 30000,
    "enableStreaming": true,
    "streamChunkSize": 10,
    "streamThreshold": 20,
    "enableWebhookCallbacks": true,
    "webhookCallback": {
      "url": "https://example.com/webhook",
      "method": "POST",
      "headers": { "Authorization": "Bearer token" },
      "includeRequestParams": true,
      "retries": 3,
      "timeout": 10000,
      "secret": "your-hmac-secret"
    }
  }

Examples:
  # Start with stdio transport (default)
  qa-guardian-mcp

  # Start with config file
  qa-guardian-mcp --config mcp-config.json

  # Start with SSE transport on port 3000
  qa-guardian-mcp --transport sse --port 3000

  # Connect to custom API URL
  qa-guardian-mcp --api-url http://localhost:3001

  # Require API key authentication
  qa-guardian-mcp --require-auth --api-key your-api-key

  # Set custom rate limit (50 requests per 30 seconds)
  qa-guardian-mcp --rate-limit 50 --rate-limit-window 30

  # Set tool execution timeout (60 seconds for long-running operations)
  qa-guardian-mcp --tool-timeout 60000

  # Configure streaming for large results
  qa-guardian-mcp --stream-chunk-size 25 --stream-threshold 50

  # Enable webhook callbacks for all operations
  qa-guardian-mcp --webhook-callback https://example.com/webhook
  `);
}

/**
 * Main entry point for the MCP server
 */
export async function main(): Promise<void> {
  const config = parseArgs();
  const server = new MCPServer(config);

  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Run if executed directly
// Note: When this file is the main module, start the server
if (require.main === module) {
  main();
}
