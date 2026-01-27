const API_KEY = 'qg_8yMJN_odoNAvwNUtJXyHMs9vcSLtfSG-ADdvSTKwP1w';
const SUITE_ID = '1768526840773';
const MCP_URL = 'http://localhost:3458';

async function importTests() {
  // Get session
  const sessionResponse = await fetch(`${MCP_URL}/sse`);
  const reader = sessionResponse.body?.getReader();
  const decoder = new TextDecoder();
  let sessionId = '';
  if (reader) {
    const { value } = await reader.read();
    const text = decoder.decode(value);
    const match = text.match(/sessionId=([a-f0-9-]+)/);
    if (match) sessionId = match[1];
    reader.cancel();
  }
  console.log('Session:', sessionId);

  // Import tests
  const response = await fetch(`${MCP_URL}/message?sessionId=${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'import_tests',
        arguments: {
          suite_id: SUITE_ID,
          tests: [
            { name: 'Test A - First', type: 'e2e', description: 'First test' },
            { name: 'Test B - Second', type: 'e2e', description: 'Second test' },
            { name: 'Test C - Third', type: 'e2e', description: 'Third test' },
          ],
        },
      },
    }),
  });
  const result = await response.json();
  console.log('Import result:', JSON.stringify(result, null, 2));
}
importTests().catch(console.error);
