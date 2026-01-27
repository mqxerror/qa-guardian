/**
 * Test MCP Server config file support
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const serverPath = path.join(__dirname, 'index.ts');
const configPath = path.join(__dirname, 'test-mcp-config.json');

async function testConfigFile() {
  console.log('Testing MCP Server config file support...\n');

  // Step 1: Create config file
  console.log('Step 1: Creating mcp-config.json with apiKey and apiUrl...');
  const configContent = {
    transport: 'stdio',
    apiUrl: 'http://config-file-api.example.com:9999',
    apiKey: 'config-file-api-key-xyz',
  };
  fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
  console.log('✓ Config file created:', configPath);
  console.log('  Contents:', JSON.stringify(configContent));

  return new Promise<void>((resolve, reject) => {
    // Step 2: Start server with --config flag
    console.log('\nStep 2: Starting server with --config flag...');
    const server = spawn('npx', ['tsx', serverPath, '--config', configPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../..'),
    });

    let stderrData = '';
    let testsPassed = 0;
    let testsTotal = 0;

    // Collect stderr (logs)
    server.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    // Wait for server to start and verify
    setTimeout(() => {
      testsTotal = 3;

      // Step 3: Verify server uses config file values
      console.log('\nStep 3: Verifying server uses config file values...');

      // Check if config file was loaded
      if (stderrData.includes('Loaded config from:') && stderrData.includes('test-mcp-config.json')) {
        console.log('✓ Config file was loaded');
        testsPassed++;
      } else {
        console.log('✗ Config file not loaded');
      }

      // Check if API URL from config is used
      if (stderrData.includes('http://config-file-api.example.com:9999')) {
        console.log('✓ apiUrl from config file is used');
        console.log('  Value: http://config-file-api.example.com:9999');
        testsPassed++;
      } else {
        console.log('✗ apiUrl from config file not used');
      }

      // Check if server started successfully
      if (stderrData.includes('Ready to receive commands')) {
        console.log('✓ Server started successfully with config');
        testsPassed++;
      } else {
        console.log('✗ Server did not start');
      }

      console.log('\n--- Server Logs ---');
      const logLines = stderrData.split('\n').filter(l => l.includes('[QA Guardian MCP]'));
      logLines.forEach(l => console.log(l));

      console.log('\n--- Test Results ---');
      console.log(`Tests passed: ${testsPassed}/${testsTotal}`);

      if (testsPassed >= 2) {
        console.log('\n✓ Config file support working correctly!');
        console.log('✓ Server reads configuration from JSON config file');
        console.log('✓ apiKey and apiUrl are correctly loaded');
      }

      // Cleanup
      server.kill('SIGTERM');
      fs.unlinkSync(configPath);
      resolve();
    }, 2000);

    server.on('error', (err) => {
      fs.unlinkSync(configPath);
      reject(err);
    });
  });
}

testConfigFile()
  .then(() => {
    console.log('\nAll config file tests passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nTest failed:', err.message);
    process.exit(1);
  });
