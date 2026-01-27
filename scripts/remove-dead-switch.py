#!/usr/bin/env python3
"""
Script to remove the dead switch statement from server.ts
Feature #1356: Backend file size limit enforcement

The switch statement from line 3053 to 19745 is dead code because:
1. All 138 tools now have handlers in the handler registry
2. The hasHandler() check at line 3034 executes first
3. If a handler exists, executeHandler() is called and returns
4. The switch statement is never reached for any known tool

This script replaces the switch statement with just the default case logic.
"""

import re

def remove_switch():
    with open('backend/src/mcp/server.ts', 'r') as f:
        content = f.read()

    # Find the start marker (after the handler execution return)
    start_marker = """          return await executeHandler(toolName, toolArgs, handlerContext);
        }

        // Fall through to legacy switch statement for tools not yet extracted"""

    # Find the end marker (the closing of the switch/function and the execution)
    end_marker = """          }
        }
      };

      // Execute tool with timeout"""

    # The replacement content
    replacement = """          return await executeHandler(toolName, toolArgs, handlerContext);
        }

        // Feature #1356: All tools now have handlers - switch statement removed
        // If we reach here, the tool is unknown (not in handler registry)

        // Get list of available tools
        const availableTools = TOOLS.map(t => t.name);

        // Find similar tool names using simple string matching
        const suggestions = this.findSimilarTools(toolName, availableTools);

        // Build helpful error message
        let errorMessage = `Unknown tool: ${toolName}.`;
        if (suggestions.length > 0) {
          errorMessage += ` Did you mean: ${suggestions.join(', ')}?`;
        }

        this.log(`[ERROR] Unknown tool invocation: ${toolName}`);

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

      // Execute tool with timeout"""

    # Find the position of start marker
    start_pos = content.find(start_marker)
    if start_pos == -1:
        print("ERROR: Could not find start marker")
        return False

    # Find the position of end marker (after start_pos)
    end_pos = content.find(end_marker, start_pos)
    if end_pos == -1:
        print("ERROR: Could not find end marker")
        return False

    # Calculate what to remove
    remove_start = start_pos
    remove_end = end_pos + len(end_marker)

    print(f"Start marker found at position {start_pos}")
    print(f"End marker found at position {end_pos}")
    print(f"Removing {remove_end - remove_start} characters")

    # Preview lines being removed
    removed_content = content[remove_start:remove_end]
    line_count = removed_content.count('\n')
    print(f"Lines being replaced: ~{line_count}")

    # Create the new content
    new_content = content[:remove_start] + replacement + content[remove_end:]

    # Write the new content
    with open('backend/src/mcp/server.ts', 'w') as f:
        f.write(new_content)

    # Count lines in new file
    new_line_count = new_content.count('\n')
    print(f"New file line count: {new_line_count}")

    return True

if __name__ == '__main__':
    import sys
    if remove_switch():
        print("SUCCESS: Switch statement removed")
        sys.exit(0)
    else:
        print("FAILED: Could not remove switch statement")
        sys.exit(1)
