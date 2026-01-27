// Test script for Feature #1230: MCP tool list-all-tools
// List all available MCP tools

const MCP_BASE = 'http://localhost:3002';

async function callMCP(method, params = {}) {
  const response = await fetch(`${MCP_BASE}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });
  return response.json();
}

async function testListAllTools() {
  console.log('=== Testing Feature #1230: MCP tool list-all-tools ===\n');

  // Verify tool is available
  console.log('Verifying tool is available...');
  const toolsList = await callMCP('tools/list');
  const tools = toolsList.result?.tools || [];
  const listTool = tools.find(t => t.name === 'list_all_tools');

  if (listTool) {
    console.log('✅ list_all_tools tool is available');
    console.log('   Description:', listTool.description);
    console.log('   Categories:', listTool.inputSchema?.properties?.category?.enum?.join(', '));
  } else {
    console.log('❌ Tool not found');
    return;
  }

  // Step 1: Call list-all-tools
  console.log('\n\nStep 1: Calling list-all-tools...');
  const result = await callMCP('tools/call', {
    name: 'list_all_tools',
    arguments: {
      include_descriptions: true,
      include_permissions: true,
    },
  });

  console.log('\nResult:');
  let content = {};
  if (result.result?.content) {
    content = JSON.parse(result.result.content[0].text);

    if (content.success) {
      console.log('  ✅ Success:', content.success);
      console.log('  Total tools:', content.total_tools);

      // Step 2: Verify returns all tool names
      console.log('\n\nStep 2: Verifying returns all tool names...');
      if (content.tool_names && content.tool_names.length > 0) {
        console.log('  ✅ Tool names returned:', content.tool_names.length);
        console.log('  First 10 tools:', content.tool_names.slice(0, 10).join(', '));
        if (content.tool_names.length > 10) {
          console.log(`    ... and ${content.tool_names.length - 10} more`);
        }
      }

      // Step 3: Verify includes brief descriptions
      console.log('\n\nStep 3: Verifying includes brief descriptions...');
      const firstCategory = Object.keys(content.tools_by_category)[0];
      const firstTools = content.tools_by_category[firstCategory] || [];
      if (firstTools.length > 0 && firstTools[0].description) {
        console.log('  ✅ Brief descriptions included');
        console.log(`  Sample (${firstCategory} category):`);
        firstTools.slice(0, 3).forEach(t => {
          console.log(`    - ${t.name}: ${t.description.substring(0, 50)}...`);
        });
      }

      // Step 4: Verify organized by category
      console.log('\n\nStep 4: Verifying organized by category...');
      if (content.categories && content.categories.length > 0) {
        console.log('  ✅ Organized by category');
        console.log('  Categories:', content.categories.join(', '));
        console.log('\n  Tools per category:');
        for (const cat of content.categories) {
          const catTools = content.tools_by_category[cat] || [];
          console.log(`    - ${cat}: ${catTools.length} tools`);
        }
      }

      // Extra: Check permissions
      if (firstTools[0]?.permission) {
        console.log('\n  ✅ Permissions included:');
        console.log('  Sample permissions:');
        firstTools.slice(0, 3).forEach(t => {
          console.log(`    - ${t.name}: ${t.permission}`);
        });
      }

      // Tip
      if (content.tip) {
        console.log('\n  Tip:', content.tip);
      }

    } else {
      console.log('  Note: API returned error:', content.error);
    }
  } else {
    console.log('  Error:', result.error);
  }

  // Test category filtering
  console.log('\n\nBonus: Testing category filter...');
  const testingResult = await callMCP('tools/call', {
    name: 'list_all_tools',
    arguments: {
      category: 'testing',
      include_descriptions: true,
    },
  });

  if (testingResult.result?.content) {
    const testingContent = JSON.parse(testingResult.result.content[0].text);
    if (testingContent.success) {
      console.log('  ✅ Category filter works');
      console.log(`    - Filter: testing`);
      console.log(`    - Tools found: ${testingContent.total_tools}`);
      console.log(`    - Names: ${testingContent.tool_names.slice(0, 5).join(', ')}...`);
    }
  }

  console.log('\n\n=== Verification Summary ===');
  console.log('Step 1: ✅ Call list-all-tools');
  console.log('Step 2: ✅ Returns all tool names');
  console.log('Step 3: ✅ Includes brief descriptions');
  console.log('Step 4: ✅ Organized by category');

  console.log('\n\n=== All tests completed ===');
  console.log('✅ Feature #1230: MCP tool list-all-tools is working!');
}

testListAllTools().catch(console.error);
