/**
 * Test script for Feature #1161: MCP tool - suggest_test_improvements
 *
 * Tests the suggest-test-improvements tool functionality
 */

const http = require('http');

function makeRequest(toolName, args, port = 3100) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    const options = {
      hostname: 'localhost',
      port: port,
      path: '/mcp/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

async function runTests() {
  console.log('=== Testing Feature #1161: MCP tool - suggest_test_improvements ===\n');

  try {
    // Test 1: Call suggest_test_improvements with a test ID
    console.log('Step 1: Call suggest-test-improvements with testId...');
    const response1 = await makeRequest('suggest_test_improvements', {
      test_id: 'test-001'
    });

    if (response1.error) {
      console.log('  Error response:', response1.error.message);
      process.exit(1);
    } else if (response1.result?.content) {
      const resultText = response1.result.content[0]?.text;
      if (resultText) {
        const result = JSON.parse(resultText);
        console.log('  ✓ Response received');
        console.log('  Test ID:', result.test_id);
        console.log('  Suggestions count:', result.suggestions_count);

        // Step 2: Verify returns improvement suggestions
        console.log('\nStep 2: Verify returns improvement suggestions...');
        if (result.suggestions && Array.isArray(result.suggestions)) {
          console.log('  ✓ Suggestions array returned with', result.suggestions.length, 'suggestions');

          if (result.suggestions.length > 0) {
            const suggestion = result.suggestions[0];
            console.log('  First suggestion:');
            console.log('    - Title:', suggestion.title);
            console.log('    - Severity:', suggestion.severity);
            console.log('    - Category:', suggestion.category);
            console.log('    - Impact:', suggestion.impact);

            // Step 3: Verify includes code examples
            console.log('\nStep 3: Verify includes code examples...');
            if (suggestion.before_code && suggestion.after_code) {
              console.log('  ✓ Code examples included');
              console.log('  Before code:', suggestion.before_code.substring(0, 50) + '...');
              console.log('  After code:', suggestion.after_code.substring(0, 50) + '...');
            } else {
              console.log('  ✗ Code examples missing');
              process.exit(1);
            }

            // Step 4: Verify includes reasoning
            console.log('\nStep 4: Verify includes reasoning...');
            if (suggestion.reasoning) {
              console.log('  ✓ Reasoning included');
              console.log('  Reasoning:', suggestion.reasoning.substring(0, 100) + '...');
            } else {
              console.log('  ✗ Reasoning missing');
              process.exit(1);
            }
          }
        } else {
          console.log('  ✗ Suggestions array missing');
          process.exit(1);
        }

        // Print summary
        console.log('\n=== Summary ===');
        console.log('Summary by severity:');
        console.log('  - Critical:', result.summary?.critical || 0);
        console.log('  - High:', result.summary?.high || 0);
        console.log('  - Medium:', result.summary?.medium || 0);
        console.log('  - Low:', result.summary?.low || 0);
        console.log('Overall quality score:', result.overall_quality_score);
        console.log('Improvement potential:', result.improvement_potential);

        console.log('\n=== All Tests Passed! ===');
      }
    } else {
      console.log('  ✗ No result content received');
      process.exit(1);
    }

  } catch (error) {
    console.error('Test failed with error:', error.message);
    console.log('\nNote: Make sure the MCP server is running on port 3100');
    console.log('Start with: npx tsx backend/src/mcp/index.ts');
    process.exit(1);
  }
}

runTests();
