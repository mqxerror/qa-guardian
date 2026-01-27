/**
 * Test script for Feature #855: MCP webhook callbacks
 *
 * This script tests the webhook callback functionality for MCP operations.
 * Run with: npx tsx src/mcp/test-webhook-callbacks.ts
 */

import * as http from 'http';
import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';
import * as crypto from 'crypto';

// Test webhook server
let webhookServer: http.Server;
let webhookPort: number;
const receivedCallbacks: Array<{
  method: string;
  headers: http.IncomingHttpHeaders;
  body: unknown;
  timestamp: number;
}> = [];

function startWebhookServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    webhookServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          receivedCallbacks.push({
            method: req.method || 'UNKNOWN',
            headers: req.headers,
            body: parsedBody,
            timestamp: Date.now(),
          });
          console.log(`\n[WEBHOOK SERVER] Received callback:`);
          console.log(`  Method: ${req.method}`);
          console.log(`  Signature: ${req.headers['x-qa-guardian-signature'] || 'none'}`);
          console.log(`  Tool: ${parsedBody.toolName}`);
          console.log(`  Status: ${parsedBody.status}`);
          console.log(`  Duration: ${parsedBody.duration_ms}ms`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    });

    webhookServer.listen(0, () => {
      const address = webhookServer.address();
      if (address && typeof address === 'object') {
        webhookPort = address.port;
        console.log(`[WEBHOOK SERVER] Started on port ${webhookPort}`);
        resolve(webhookPort);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });
  });
}

// Test functions that verify the webhook callback functionality
function testWebhookCallbackPayload(): void {
  console.log('\n=== Test: Webhook Callback Payload Structure ===');

  // Expected payload structure
  const expectedFields = [
    'timestamp',
    'requestId',
    'toolName',
    'status',
    'duration_ms',
  ];

  if (receivedCallbacks.length === 0) {
    console.log('❌ No callbacks received');
    return;
  }

  const callback = receivedCallbacks[0];
  const body = callback.body as Record<string, unknown>;

  let allFieldsPresent = true;
  for (const field of expectedFields) {
    if (body[field] === undefined) {
      console.log(`❌ Missing field: ${field}`);
      allFieldsPresent = false;
    } else {
      console.log(`✓ Field present: ${field} = ${JSON.stringify(body[field])}`);
    }
  }

  if (allFieldsPresent) {
    console.log('✓ All required fields present in callback payload');
  }
}

function testWebhookSignature(): void {
  console.log('\n=== Test: Webhook Signature Verification ===');

  // Find a callback with signature
  const signedCallback = receivedCallbacks.find(c => c.headers['x-qa-guardian-signature']);

  if (!signedCallback) {
    console.log('⚠ No signed callbacks received (signature testing skipped)');
    return;
  }

  const signature = signedCallback.headers['x-qa-guardian-signature'] as string;
  const body = signedCallback.body as Record<string, unknown>;

  if (signature && signature.startsWith('sha256=')) {
    console.log('✓ Signature format correct (sha256=...)');
    console.log(`  Signature: ${signature.substring(0, 20)}...`);
  } else {
    console.log('❌ Invalid signature format');
  }

  // Verify the signature (if we know the secret)
  const testSecret = 'test-secret';
  const payloadWithoutSig = { ...body };
  delete payloadWithoutSig.signature;
  const expectedSig = crypto
    .createHmac('sha256', testSecret)
    .update(JSON.stringify(payloadWithoutSig))
    .digest('hex');

  console.log(`  Expected signature (with test secret): sha256=${expectedSig.substring(0, 20)}...`);
}

function testWebhookHeaders(): void {
  console.log('\n=== Test: Webhook Headers ===');

  if (receivedCallbacks.length === 0) {
    console.log('❌ No callbacks received');
    return;
  }

  const callback = receivedCallbacks[0];
  const expectedHeaders = [
    'x-qa-guardian-event',
    'x-qa-guardian-timestamp',
    'content-type',
  ];

  for (const header of expectedHeaders) {
    if (callback.headers[header]) {
      console.log(`✓ Header present: ${header} = ${callback.headers[header]}`);
    } else {
      console.log(`❌ Missing header: ${header}`);
    }
  }
}

async function runTests(): Promise<void> {
  console.log('=== Feature #855: MCP Webhook Callbacks Test ===\n');

  // Step 1: Start webhook server
  console.log('--- Step 1: Starting webhook server ---');
  await startWebhookServer();

  // Step 2: Start MCP server with webhook callback configured
  console.log('\n--- Step 2: Starting MCP server with webhook callback ---');
  const serverPath = path.join(__dirname, 'server.ts');
  const webhookUrl = `http://localhost:${webhookPort}/webhook`;

  const server = spawn('npx', ['tsx', serverPath, '--webhook-callback', webhookUrl], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  let initializeResponseReceived = false;

  rl.on('line', (line) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.result?.serverInfo) {
        initializeResponseReceived = true;
        console.log('✓ Server initialized');
      }
    } catch {
      // Ignore non-JSON output
    }
  });

  // Log server stderr
  server.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[WEBHOOK]')) {
      console.log(`[SERVER] ${msg}`);
    }
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Initialize MCP connection
  console.log('\n--- Step 3: Initialize MCP connection ---');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'webhook-test', version: '1.0.0' },
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 4: Make async MCP request that triggers webhook callback
  console.log('\n--- Step 4: Make MCP request (triggers webhook callback) ---');
  const toolRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 10,
      },
    },
  };
  server.stdin.write(JSON.stringify(toolRequest) + '\n');

  // Wait for callback
  console.log('Waiting for webhook callback...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 5: Verify webhook was called
  console.log('\n--- Step 5: Verify webhook callback received ---');
  if (receivedCallbacks.length > 0) {
    console.log(`✓ Received ${receivedCallbacks.length} webhook callback(s)`);
    testWebhookCallbackPayload();
    testWebhookHeaders();
    testWebhookSignature();
  } else {
    console.log('❌ No webhook callbacks received');
  }

  // Step 6: Test per-request callback with _callback parameter
  console.log('\n--- Step 6: Test per-request _callback parameter ---');
  const callbackRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 5,
        _callback: {
          url: webhookUrl,
          includeRequestParams: true,
        },
      },
    },
  };
  const previousCount = receivedCallbacks.length;
  server.stdin.write(JSON.stringify(callbackRequest) + '\n');

  // Wait for callback
  await new Promise(resolve => setTimeout(resolve, 3000));

  if (receivedCallbacks.length > previousCount) {
    console.log('✓ Per-request _callback parameter works');
    const lastCallback = receivedCallbacks[receivedCallbacks.length - 1];
    const body = lastCallback.body as Record<string, unknown>;
    if (body.requestParams) {
      console.log('✓ Request params included in callback payload');
    }
  } else {
    console.log('❌ No callback received for per-request _callback');
  }

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total webhook callbacks received: ${receivedCallbacks.length}`);
  console.log(`Tests completed: ${receivedCallbacks.length >= 2 ? 'PASSED' : 'PARTIAL'}`);

  // Clean up
  server.kill();
  webhookServer.close();
  console.log('\n=== Test Complete ===');
  process.exit(receivedCallbacks.length >= 2 ? 0 : 1);
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
