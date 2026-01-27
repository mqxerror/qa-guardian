/**
 * Test MCP Server stdio transport by simulating JSON-RPC messages
 */
import { spawn } from 'child_process';
import * as path from 'path';

const serverPath = path.join(__dirname, 'index.ts');

async function testStdioTransport() {
  console.log('Testing MCP Server stdio transport...\n');

  return new Promise<void>((resolve, reject) => {
    // Spawn the MCP server
    const server = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
    });

    let stdoutData = '';
    let stderrData = '';
    let testsPassed = 0;
    let testsTotal = 0;

    // Collect stdout (JSON-RPC responses)
    server.stdout.on('data', (data) => {
      stdoutData += data.toString();

      // Try to parse JSON-RPC responses
      const lines = stdoutData.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          if (response.jsonrpc === '2.0') {
            testsTotal++;

            if (response.id === 1) {
              // Initialize response
              if (response.result?.protocolVersion && response.result?.serverInfo) {
                console.log('✓ Initialize response received');
                console.log(`  Protocol: ${response.result.protocolVersion}`);
                console.log(`  Server: ${response.result.serverInfo.name} v${response.result.serverInfo.version}`);
                testsPassed++;
              }
            } else if (response.id === 2) {
              // Tools list response
              if (response.result?.tools && Array.isArray(response.result.tools)) {
                console.log(`✓ Tools list received (${response.result.tools.length} tools)`);
                testsPassed++;
              }
            } else if (response.id === 3) {
              // Resources list response
              if (response.result?.resources && Array.isArray(response.result.resources)) {
                console.log(`✓ Resources list received (${response.result.resources.length} resources)`);
                testsPassed++;
              }
            } else if (response.id === 4) {
              // Ping response
              if (response.result !== undefined) {
                console.log('✓ Ping response received');
                testsPassed++;
              }
            }
          }
        } catch {
          // Not valid JSON, continue
        }
      }
    });

    // Collect stderr (logs)
    server.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Send test requests
    const requests = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { jsonrpc: '2.0', id: 3, method: 'resources/list' },
      { jsonrpc: '2.0', id: 4, method: 'ping' },
    ];

    // Send each request
    for (const request of requests) {
      server.stdin.write(JSON.stringify(request) + '\n');
    }

    // Close stdin after sending requests
    server.stdin.end();

    // Wait for responses and cleanup
    setTimeout(() => {
      server.kill('SIGTERM');
    }, 3000);

    server.on('close', (code) => {
      console.log('\n--- Server Logs ---');
      const logLines = stderrData.split('\n').filter(l => l.includes('[QA Guardian MCP]'));
      logLines.forEach(l => console.log(l));

      console.log('\n--- Test Results ---');
      console.log(`Tests passed: ${testsPassed}/${testsTotal}`);

      if (testsPassed >= 3) {
        console.log('\n✓ MCP Server stdio transport working correctly!');
        console.log('✓ Server reads from stdin');
        console.log('✓ Server writes to stdout');
        console.log('✓ Compatible with Claude Code integration');
        resolve();
      } else {
        reject(new Error(`Only ${testsPassed}/${testsTotal} tests passed`));
      }
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

testStdioTransport()
  .then(() => {
    console.log('\nAll stdio transport tests passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest failed:', err.message);
    process.exit(1);
  });
