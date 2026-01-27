#!/usr/bin/env node
/**
 * Script to remove the dead switch statement from server.ts
 * Feature #1356: Backend file size limit enforcement
 *
 * The switch statement from line 3053 to 19745 is dead code because:
 * 1. All 138 tools now have handlers in the handler registry
 * 2. The hasHandler() check at line 3034 executes first
 * 3. If a handler exists, executeHandler() is called and returns
 * 4. The switch statement is never reached for any known tool
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'backend', 'src', 'mcp', 'server.ts');

// Read the file
let content = fs.readFileSync(serverPath, 'utf8');
const originalLength = content.length;
const originalLines = content.split('\n').length;

console.log(`Original file: ${originalLines} lines, ${originalLength} chars`);

// Find start marker
const startMarker = `          return await executeHandler(toolName, toolArgs, handlerContext);
        }

        // Fall through to legacy switch statement for tools not yet extracted`;

// Find end marker
const endMarker = `          }
        }
      };

      // Execute tool with timeout`;

// The replacement
const replacement = `          return await executeHandler(toolName, toolArgs, handlerContext);
        }

        // Feature #1356: All tools now have handlers - switch statement removed
        // If we reach here, the tool is unknown (not in handler registry)

        // Get list of available tools
        const availableTools = TOOLS.map(t => t.name);

        // Find similar tool names using simple string matching
        const suggestions = this.findSimilarTools(toolName, availableTools);

        // Build helpful error message
        let errorMessage = \`Unknown tool: \${toolName}.\`;
        if (suggestions.length > 0) {
          errorMessage += \` Did you mean: \${suggestions.join(', ')}?\`;
        }

        this.log(\`[ERROR] Unknown tool invocation: \${toolName}\`);

        // Release slot before returning
        this.releaseConcurrentSlot(apiKey);

        // Return error response for unknown tool
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601, // Method not found (404 equivalent)
            message: errorMessage,
            data: {
              requestedTool: toolName,
              availableTools,
              suggestions: suggestions.length > 0 ? suggestions : undefined,
            },
          },
        } as MCPResponse;
      };

      // Execute tool with timeout`;

// Find positions
const startPos = content.indexOf(startMarker);
if (startPos === -1) {
  console.error('ERROR: Could not find start marker');
  process.exit(1);
}

const endPos = content.indexOf(endMarker, startPos);
if (endPos === -1) {
  console.error('ERROR: Could not find end marker');
  process.exit(1);
}

const removeStart = startPos;
const removeEnd = endPos + endMarker.length;

console.log(`Start marker found at char ${startPos}`);
console.log(`End marker found at char ${endPos}`);
console.log(`Removing ${removeEnd - removeStart} characters`);

const removedContent = content.substring(removeStart, removeEnd);
const removedLines = removedContent.split('\n').length;
console.log(`Lines being replaced: ${removedLines}`);

// Create new content
const newContent = content.substring(0, removeStart) + replacement + content.substring(removeEnd);

// Write the new file
fs.writeFileSync(serverPath, newContent, 'utf8');

const newLines = newContent.split('\n').length;
console.log(`New file: ${newLines} lines`);
console.log(`Lines removed: ${originalLines - newLines}`);
console.log('SUCCESS: Switch statement removed');
