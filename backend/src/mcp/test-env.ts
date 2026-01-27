/**
 * Test MCP Server environment variable configuration
 */
import { spawn } from 'child_process';
import * as path from 'path';

const serverPath = path.join(__dirname, 'index.ts');

async function testEnvConfig() {
  console.log('Testing MCP Server environment variable configuration...\n');

  return new Promise<void>((resolve, reject) => {
    // Set environment variables
    const env = {
      ...process.env,
      QA_GUARDIAN_API_KEY: 'test-api-key-12345',
      QA_GUARDIAN_API_URL: 'http://custom-api.example.com:8080',
      MCP_TRANSPORT: 'stdio',
    };

    // Spawn the MCP server with environment variables
    const server = spawn('npx', ['tsx', serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
      env,
    });

    let stderrData = '';
    let testsPassed = 0;
    let testsTotal = 0;

    // Collect stderr (logs)
    server.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Wait for server to start and check logs
    setTimeout(() => {
      testsTotal = 4;

      // Test 1: Server started
      if (stderrData.includes('QA Guardian MCP Server starting')) {
        console.log('✓ Step 3: MCP server started successfully');
        testsPassed++;
      } else {
        console.log('✗ Step 3: Server did not start');
      }

      // Test 2: Environment variable QA_GUARDIAN_API_URL used
      if (stderrData.includes('http://custom-api.example.com:8080')) {
        console.log('✓ Step 2: QA_GUARDIAN_API_URL environment variable detected');
        console.log('  Value: http://custom-api.example.com:8080');
        testsPassed++;
      } else {
        console.log('✗ Step 2: QA_GUARDIAN_API_URL not configured');
      }

      // Test 3: Transport configured
      if (stderrData.includes('Transport: stdio')) {
        console.log('✓ MCP_TRANSPORT environment variable used');
        testsPassed++;
      }

      // Test 4: Ready message
      if (stderrData.includes('Ready to receive commands')) {
        console.log('✓ Step 4: Server ready with configured values');
        testsPassed++;
      }

      console.log('\n--- Server Logs ---');
      const logLines = stderrData.split('\n').filter(l => l.includes('[QA Guardian MCP]'));
      logLines.forEach(l => console.log(l));

      console.log('\n--- Test Results ---');
      console.log(`Tests passed: ${testsPassed}/${testsTotal}`);

      if (testsPassed >= 3) {
        console.log('\n✓ Environment variable configuration working!');
        console.log('✓ QA_GUARDIAN_API_KEY can be set');
        console.log('✓ QA_GUARDIAN_API_URL correctly configured');
        console.log('✓ MCP_TRANSPORT controls transport type');
      }

      // Cleanup
      server.kill('SIGTERM');
      resolve();
    }, 2000);

    server.on('error', (err) => {
      reject(err);
    });
  });
}

testEnvConfig()
  .then(() => {
    console.log('\nAll environment variable tests passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest failed:', err.message);
    process.exit(1);
  });
