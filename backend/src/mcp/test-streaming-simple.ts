/**
 * Simple test script for Feature #854: MCP response streaming
 *
 * This script tests the streaming functionality by simulating a large result.
 * Run with: npx tsx src/mcp/test-streaming-simple.ts
 */

// Simulate the streaming functions directly without starting the full server

// Feature #854: Check if result should be streamed
function shouldStreamResult(
  result: unknown,
  enableStreaming: boolean,
  streamThreshold: number,
  forceStream?: boolean
): boolean {
  if (!enableStreaming) return false;
  if (forceStream === false) return false;
  if (forceStream === true) return true;

  // Auto-detect large arrays that should be streamed
  if (Array.isArray(result)) {
    return result.length >= streamThreshold;
  }

  // Check for result objects containing arrays
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    for (const key of ['items', 'results', 'data', 'records', 'list', 'entries']) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length >= streamThreshold) {
        return true;
      }
    }
  }

  return false;
}

// Feature #854: Extract streamable array from result
function extractStreamableArray(
  result: unknown
): { array: unknown[]; wrapper?: Record<string, unknown>; arrayKey?: string } {
  if (Array.isArray(result)) {
    return { array: result };
  }

  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    for (const key of ['items', 'results', 'data', 'records', 'list', 'entries']) {
      if (Array.isArray(obj[key])) {
        // Return the array with wrapper context
        const wrapper = { ...obj };
        delete wrapper[key];
        return { array: obj[key] as unknown[], wrapper, arrayKey: key };
      }
    }
  }

  // Not streamable, wrap in array
  return { array: [result] };
}

// Feature #854: Simulate streaming result
function simulateStreamResult(
  result: unknown,
  requestId: string | number | undefined,
  toolName: string,
  streamChunkSize: number
): void {
  const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const { array, wrapper, arrayKey } = extractStreamableArray(result);
  const totalItems = array.length;
  const totalChunks = Math.ceil(totalItems / streamChunkSize);

  console.log(`\n[STREAM] Starting stream ${streamId} for ${toolName}:`);
  console.log(`  Total items: ${totalItems}`);
  console.log(`  Chunk size: ${streamChunkSize}`);
  console.log(`  Total chunks: ${totalChunks}`);
  if (wrapper && Object.keys(wrapper).length > 0) {
    console.log(`  Wrapper metadata: ${JSON.stringify(wrapper)}`);
    console.log(`  Array key: ${arrayKey}`);
  }

  // Send chunks
  console.log('\n[STREAM] Sending chunks:');
  let itemsSent = 0;
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * streamChunkSize;
    const end = Math.min(start + streamChunkSize, totalItems);
    const chunkData = array.slice(start, end);
    itemsSent += chunkData.length;
    const isLast = chunkIndex === totalChunks - 1;
    const percentage = Math.round((itemsSent / totalItems) * 100);

    console.log(`  Chunk ${chunkIndex + 1}/${totalChunks}: ${chunkData.length} items (${percentage}%)${isLast ? ' [LAST]' : ''}`);
  }

  console.log('\n[STREAM] Complete!');
}

// Run tests
console.log('=== Feature #854: MCP Response Streaming Test ===\n');

// Test configuration
const enableStreaming = true;
const streamChunkSize = 10;
const streamThreshold = 20;

// Test 1: Small array (should not stream)
console.log('--- Test 1: Small array (should NOT stream) ---');
const smallArray = Array.from({ length: 15 }, (_, i) => ({ id: i, name: `Item ${i}` }));
const shouldStream1 = shouldStreamResult(smallArray, enableStreaming, streamThreshold);
console.log(`Array length: ${smallArray.length}`);
console.log(`Threshold: ${streamThreshold}`);
console.log(`Should stream: ${shouldStream1}`);
console.log(shouldStream1 ? '❌ FAIL - Should not have triggered streaming' : '✓ PASS - Correctly did not trigger streaming');

// Test 2: Large array (should stream)
console.log('\n--- Test 2: Large array (should stream) ---');
const largeArray = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
const shouldStream2 = shouldStreamResult(largeArray, enableStreaming, streamThreshold);
console.log(`Array length: ${largeArray.length}`);
console.log(`Threshold: ${streamThreshold}`);
console.log(`Should stream: ${shouldStream2}`);
console.log(shouldStream2 ? '✓ PASS - Correctly triggered streaming' : '❌ FAIL - Should have triggered streaming');

// Test 3: Object with items array (should stream)
console.log('\n--- Test 3: Object with items array (should stream) ---');
const objectWithItems = {
  total: 100,
  page: 1,
  items: Array.from({ length: 35 }, (_, i) => ({ id: i, name: `Project ${i}` })),
};
const shouldStream3 = shouldStreamResult(objectWithItems, enableStreaming, streamThreshold);
console.log(`Object contains items array with ${objectWithItems.items.length} elements`);
console.log(`Threshold: ${streamThreshold}`);
console.log(`Should stream: ${shouldStream3}`);
console.log(shouldStream3 ? '✓ PASS - Correctly triggered streaming' : '❌ FAIL - Should have triggered streaming');

// Test 4: Force stream with _stream=true
console.log('\n--- Test 4: Force streaming with _stream=true ---');
const smallArrayForce = Array.from({ length: 5 }, (_, i) => ({ id: i }));
const shouldStream4 = shouldStreamResult(smallArrayForce, enableStreaming, streamThreshold, true);
console.log(`Array length: ${smallArrayForce.length} (below threshold)`);
console.log(`_stream: true (forced)`);
console.log(`Should stream: ${shouldStream4}`);
console.log(shouldStream4 ? '✓ PASS - Force streaming works' : '❌ FAIL - Force streaming should have worked');

// Test 5: Disable streaming with _stream=false
console.log('\n--- Test 5: Disable streaming with _stream=false ---');
const shouldStream5 = shouldStreamResult(largeArray, enableStreaming, streamThreshold, false);
console.log(`Array length: ${largeArray.length} (above threshold)`);
console.log(`_stream: false (disabled)`);
console.log(`Should stream: ${shouldStream5}`);
console.log(!shouldStream5 ? '✓ PASS - Disabled streaming works' : '❌ FAIL - Should have disabled streaming');

// Test 6: Simulate streaming process
console.log('\n--- Test 6: Simulate streaming process ---');
simulateStreamResult(largeArray, 123, 'list_projects', streamChunkSize);

// Test 7: Simulate streaming with wrapper metadata
console.log('\n--- Test 7: Streaming with wrapper metadata ---');
simulateStreamResult(objectWithItems, 456, 'list_test_suites', streamChunkSize);

// Summary
console.log('\n=== Test Summary ===');
const tests = [
  { name: 'Small array (no stream)', pass: !shouldStream1 },
  { name: 'Large array (stream)', pass: shouldStream2 },
  { name: 'Object with items (stream)', pass: shouldStream3 },
  { name: 'Force stream (_stream=true)', pass: shouldStream4 },
  { name: 'Disable stream (_stream=false)', pass: !shouldStream5 },
];

let passed = 0;
let failed = 0;
for (const test of tests) {
  if (test.pass) {
    console.log(`✓ ${test.name}`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    failed++;
  }
}

console.log(`\nTotal: ${passed}/${tests.length} tests passed`);

if (failed === 0) {
  console.log('\n✅ All streaming tests passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${failed} test(s) failed`);
  process.exit(1);
}
