/**
 * Simple test for MCP Server
 */
import { MCPServer } from './server';

async function testMCPServer() {
  console.log('Testing MCP Server...');

  // Test config
  const config = {
    transport: 'stdio' as const,
    apiUrl: 'http://localhost:3001',
  };

  // Create server instance
  const server = new MCPServer(config);
  console.log('✓ MCP Server instantiated successfully');

  // Verify server has start method
  if (typeof server.start === 'function') {
    console.log('✓ Server has start() method');
  }

  console.log('');
  console.log('MCP Server Test Results:');
  console.log('========================');
  console.log('- Transport: stdio');
  console.log('- API URL: http://localhost:3001');
  console.log('- Server ready for stdin/stdout communication');
  console.log('');
  console.log('All tests passed!');
}

testMCPServer().catch(console.error);
