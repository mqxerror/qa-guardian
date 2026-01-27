/**
 * Test script for Feature #854: MCP response streaming
 *
 * This script tests the streaming functionality for large result sets.
 * Run with: npx tsx src/mcp/test-streaming.ts
 */

import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

// Test helper to generate a large result set
async function testStreaming(): Promise<void> {
  console.log('=== Feature #854: MCP Response Streaming Test ===\n');

  // Start the MCP server process with streaming enabled
  const serverPath = path.join(__dirname, 'server.ts');
  const server = spawn('npx', ['tsx', serverPath, '--stream-threshold', '5', '--stream-chunk-size', '3'], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  // Collect all responses and notifications
  const responses: unknown[] = [];
  const notifications: unknown[] = [];
  let initializeResponseReceived = false;

  rl.on('line', (line) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.method === 'notifications/stream/chunk') {
        notifications.push(parsed);
        console.log(`[CHUNK ${parsed.params?.chunkIndex + 1}/${parsed.params?.totalChunks}] Received ${parsed.params?.data?.length || 0} items (${parsed.params?.progress?.percentage}%)`);
      } else if (parsed.id !== undefined) {
        responses.push(parsed);
        if (parsed.result?.serverInfo) {
          initializeResponseReceived = true;
          console.log('✓ Server initialized');
        }
      }
    } catch {
      // Ignore non-JSON output
    }
  });

  // Log server stderr
  server.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[STREAM]')) {
      console.log(`[SERVER] ${msg}`);
    }
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Step 1: Initialize the MCP connection
  console.log('\n--- Step 1: Initialize connection ---');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'streaming-test', version: '1.0.0' },
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');

  // Wait for initialize response
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 2: Test streaming with list_projects (simulated large result)
  console.log('\n--- Step 2: Test streaming with explicit _stream parameter ---');
  const streamRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        limit: 50,
        _stream: true, // Force streaming
      },
    },
  };
  server.stdin.write(JSON.stringify(streamRequest) + '\n');

  // Wait for streaming to complete
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 3: Test auto-detection (when threshold is met)
  console.log('\n--- Step 3: Test auto-detection of large results ---');
  const autoStreamRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_test_suites',
      arguments: {
        project_id: 'demo-project',
      },
    },
  };
  server.stdin.write(JSON.stringify(autoStreamRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Test disabled streaming
  console.log('\n--- Step 4: Test disabled streaming with _stream=false ---');
  const noStreamRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'list_projects',
      arguments: {
        _stream: false, // Explicitly disable streaming
      },
    },
  };
  server.stdin.write(JSON.stringify(noStreamRequest) + '\n');

  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Total responses received: ${responses.length}`);
  console.log(`Total stream chunks received: ${notifications.length}`);

  // Check if streaming worked
  const streamingResponses = responses.filter((r: any) => r.result?._streaming);
  console.log(`Streaming responses: ${streamingResponses.length}`);

  if (notifications.length > 0) {
    console.log('\n✓ Streaming notifications received successfully');
    const firstChunk = notifications[0] as any;
    const lastChunk = notifications[notifications.length - 1] as any;
    console.log(`  Stream ID: ${firstChunk.params?.streamId}`);
    console.log(`  First chunk: ${firstChunk.params?.data?.length || 0} items`);
    console.log(`  Last chunk: ${lastChunk.params?.data?.length || 0} items`);
    console.log(`  Total chunks: ${firstChunk.params?.totalChunks}`);
  } else {
    console.log('\n⚠ No streaming notifications received (result may have been below threshold)');
  }

  // Clean up
  server.kill();
  console.log('\n=== Test Complete ===');
  process.exit(0);
}

// Run the test
testStreaming().catch(console.error);
