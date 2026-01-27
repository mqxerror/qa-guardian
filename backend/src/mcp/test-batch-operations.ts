/**
 * Test script for Feature #856: MCP batch operations support
 *
 * This script tests the batch operations functionality for MCP.
 * Run with: npx tsx src/mcp/test-batch-operations.ts
 */

import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

async function testBatchOperations(): Promise<void> {
  console.log('=== Feature #856: MCP Batch Operations Test ===\n');

  // Start the MCP server
  const serverPath = path.join(__dirname, 'server.ts');
  const server = spawn('npx', ['tsx', serverPath], {
    cwd: path.join(__dirname, '..', '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({
    input: server.stdout,
    crlfDelay: Infinity,
  });

  // Collect responses
  const responses: Map<string | number, unknown> = new Map();

  rl.on('line', (line) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.id !== undefined) {
        responses.set(parsed.id, parsed);
        if (parsed.result?.serverInfo) {
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
    if (msg.includes('[BATCH]')) {
      console.log(`[SERVER] ${msg}`);
    }
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 1: Initialize the MCP connection
  console.log('\n--- Step 1: Initialize connection ---');
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'batch-test', version: '1.0.0' },
    },
  };
  server.stdin.write(JSON.stringify(initRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 2: Create batch request with 5 operations
  console.log('\n--- Step 2: Create batch request with 5 operations ---');
  const batchRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call-batch',
    params: {
      operations: [
        { id: 'op1', name: 'list_projects', arguments: { limit: 5 } },
        { id: 'op2', name: 'get_project', arguments: { project_id: 'demo-project' } },
        { id: 'op3', name: 'list_test_suites', arguments: { project_id: 'demo-project' } },
        { id: 'op4', name: 'list_recent_runs', arguments: { limit: 3 } },
        { id: 'op5', name: 'get_run_status', arguments: { run_id: 'demo-run-1' } },
      ],
      parallel: false,
      stopOnError: false,
    },
  };

  console.log('Batch operations:');
  for (const op of batchRequest.params.operations) {
    console.log(`  - ${op.id}: ${op.name}`);
  }

  // Step 3: Submit batch
  console.log('\n--- Step 3: Submit batch ---');
  server.stdin.write(JSON.stringify(batchRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Step 4: Verify all operations execute
  console.log('\n--- Step 4: Verify all operations execute ---');
  const batchResponse = responses.get(2);

  if (batchResponse) {
    const result = (batchResponse as any).result;
    const batch = result?._batch;

    if (batch) {
      console.log(`✓ Batch ID: ${batch.batchId}`);
      console.log(`  Total operations: ${batch.totalOperations}`);
      console.log(`  Succeeded: ${batch.succeeded}`);
      console.log(`  Failed: ${batch.failed}`);
      console.log(`  Duration: ${batch.duration_ms}ms`);

      // Step 5: Verify batch response with all results
      console.log('\n--- Step 5: Verify batch response with all results ---');
      console.log('Individual results:');
      for (const res of batch.results) {
        console.log(`  ${res.id}: ${res.status} (${res.duration_ms}ms)`);
        if (res.status === 'error') {
          console.log(`    Error: ${res.error.message}`);
        }
      }

      // Test summary
      console.log('\n=== Test Summary ===');
      if (batch.totalOperations === 5) {
        console.log('✓ All 5 operations were processed');
      } else {
        console.log(`❌ Expected 5 operations, got ${batch.totalOperations}`);
      }

      if (batch.results.length === 5) {
        console.log('✓ All 5 results returned');
      } else {
        console.log(`❌ Expected 5 results, got ${batch.results.length}`);
      }
    } else {
      console.log('❌ No batch response received');
    }
  } else {
    console.log('❌ No response for batch request');
  }

  // Test parallel execution
  console.log('\n--- Test: Parallel batch execution ---');
  const parallelBatchRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call-batch',
    params: {
      operations: [
        { id: 'p1', name: 'list_projects', arguments: { limit: 3 } },
        { id: 'p2', name: 'list_projects', arguments: { limit: 3 } },
        { id: 'p3', name: 'list_projects', arguments: { limit: 3 } },
      ],
      parallel: true,
    },
  };
  server.stdin.write(JSON.stringify(parallelBatchRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const parallelResponse = responses.get(3);
  if (parallelResponse) {
    const result = (parallelResponse as any).result?._batch;
    if (result) {
      console.log(`✓ Parallel batch completed: ${result.succeeded}/${result.totalOperations} succeeded in ${result.duration_ms}ms`);
    }
  }

  // Test stop on error
  console.log('\n--- Test: Stop on error ---');
  const stopOnErrorRequest = {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call-batch',
    params: {
      operations: [
        { id: 's1', name: 'list_projects', arguments: { limit: 1 } },
        { id: 's2', name: 'unknown_tool', arguments: {} }, // This will fail
        { id: 's3', name: 'list_projects', arguments: { limit: 1 } }, // Should not execute
      ],
      parallel: false,
      stopOnError: true,
    },
  };
  server.stdin.write(JSON.stringify(stopOnErrorRequest) + '\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const stopOnErrorResponse = responses.get(4);
  if (stopOnErrorResponse) {
    const result = (stopOnErrorResponse as any).result?._batch;
    if (result) {
      console.log(`  Total: ${result.totalOperations}, Executed: ${result.results.length}`);
      if (result.results.length === 2) {
        console.log('✓ Batch stopped after error (only 2 operations executed)');
      } else {
        console.log(`❌ Expected 2 results (stopOnError), got ${result.results.length}`);
      }
    }
  }

  // Clean up
  server.kill();
  console.log('\n=== Test Complete ===');
  process.exit(0);
}

// Run the test
testBatchOperations().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
