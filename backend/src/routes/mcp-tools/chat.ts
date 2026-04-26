/**
 * MCP Tools Module - Chat Route
 * Feature #730: Split mcp-tools/routes.ts into sub-modules
 *
 * AI-powered chat endpoint with tool execution capability.
 * Claude can request tool execution by including TOOL_CALL blocks in its response.
 */

import { FastifyInstance } from 'fastify';
import { aiRouter } from '../../services/providers/ai-router.js';
import { executeHandler, hasHandler } from '../../mcp/handlers/index.js';
import { sendError } from '../../utils/errors.js';
import { validateBody, mcpChatBodySchema } from '../../validation/index.js';
import { ensureAIInitialized, createHandlerContext, checkForErrorInResult, logger } from './helpers.js';
import { buildChatSystemPrompt } from './chat-system-prompt.js';

export async function registerChatRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/mcp/chat
   * AI-powered chat endpoint with tool execution capability
   * Claude can request tool execution by including TOOL_CALL blocks in its response
   */
  // Feature #715: Zod validation for MCP chat body
  fastify.post<{
    Body: {
      message: string;
      context?: {
        project_id?: string;
        project_name?: string;
        test_id?: string;
        current_page?: string;
        conversation_history?: Array<{ role: string; content: string }>;
      };
      // Feature #1941: Complexity-based model routing
      complexity?: 'simple' | 'complex';
      // Feature #2074: User-selected provider/model preferences
      provider?: 'kie' | 'anthropic' | 'auto';
      model?: string;
    };
  }>('/chat', {
    preValidation: [validateBody(mcpChatBodySchema)],
  }, async (request, reply) => {
    const startTime = Date.now();

    try {
      const { message, context = {}, complexity = 'complex', model, provider } = request.body;

      // Feature #2074: User-specified model takes precedence
      // Feature #1941: Fallback to complexity-based model routing
      const modelByComplexity = {
        simple: 'claude-3-haiku-20240307',
        complex: 'claude-sonnet-4-20250514',  // Claude Sonnet 4 for complex analysis
      };
      // If user specified a model (from preferences), use that; otherwise use complexity-based selection
      const selectedModel = model || modelByComplexity[complexity];
      logger.info(`User model: ${model || 'auto'}, Complexity: ${complexity}, Selected model: ${selectedModel}`);

      if (!message) {
        return sendError(reply, 400, 'BAD_REQUEST', 'Missing required parameter: message');
      }

      // Ensure AI is initialized (handles late env var loading)
      ensureAIInitialized();

      // Check if AI is available
      if (!aiRouter.isInitialized()) {
        return sendError(reply, 503, 'SERVICE_UNAVAILABLE', 'AI service is not available. Please check your API keys in .env', { metadata: {
            used_real_ai: false,
            execution_time_ms: Date.now() - startTime,
          } });
      }

      logger.info(`Processing chat: "${message.substring(0, 80)}..."`);

      // Create handler context for tool execution
      const handlerContext = createHandlerContext(request);

      // Build the system prompt that tells Claude about available tools
      const systemPrompt = buildChatSystemPrompt(context);

      // Multi-turn tool execution loop
      // Claude can make tool calls, we execute them, send results back, and Claude can continue
      const MAX_TOOL_TURNS = 5; // Prevent infinite loops
      const MAX_EXECUTION_TIME_MS = 55000; // Feature #1930: Maximum 55 seconds for entire chat request
      let turnCount = 0;
      const allToolsExecuted: Array<{ tool: string; args: Record<string, unknown>; result: unknown; success: boolean }> = [];
      const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        { role: 'user', content: message }
      ];

      let finalResponse = '';
      let lastAiResponse: { actualProvider?: string; model?: string; inputTokens?: number; outputTokens?: number } = {};

      while (turnCount < MAX_TOOL_TURNS) {
        // Feature #1924: Check if we've exceeded maximum execution time
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > MAX_EXECUTION_TIME_MS) {
          logger.info(`Chat request exceeded maximum execution time (${elapsedTime}ms > ${MAX_EXECUTION_TIME_MS}ms)`);
          return sendError(reply, 504, 'ERROR', 'AI analysis timed out. The request took too long to process. Please try again.', { metadata: {
              used_real_ai: true,
              execution_time_ms: elapsedTime,
              turns_completed: turnCount,
              tools_executed: allToolsExecuted.length,
            } });
        }

        turnCount++;
        logger.info(`Tool execution turn ${turnCount}/${MAX_TOOL_TURNS}`);

        // Call the AI router with complexity-based model selection (Feature #1941)
        // P2.3: honor `provider` from request body. Without this, the chat
        // handler always routed to the global primary (Kie → Anthropic on
        // failover) regardless of the user's task preference. Symptom: a
        // chat call with provider='deepseek' still hit Anthropic and 400'd
        // when Anthropic's credit was exhausted.
        // 'auto' / undefined falls through to feature-based smart routing.
        const aiResponse = await aiRouter.sendMessage(
          conversationMessages,
          {
            systemPrompt,
            temperature: 0.7,
            maxTokens: 4000,
            model: selectedModel,
            preferredProvider: (provider && provider !== 'auto')
              ? (provider as 'kie' | 'anthropic' | 'deepseek')
              : undefined,
            feature: provider === 'auto' || !provider ? 'chat' : undefined,
          }
        );

        // Store the last AI response metadata
        lastAiResponse = {
          actualProvider: aiResponse.actualProvider,
          model: aiResponse.model,
          inputTokens: aiResponse.inputTokens,
          outputTokens: aiResponse.outputTokens,
        };

        const responseContent = aiResponse.content || 'No response generated';

        // Parse tool calls from the response
        const toolCallRegex = /```tool_call\s*\n([\s\S]*?)\n```/g;
        const toolCallsInResponse: Array<{ tool: string; args: Record<string, unknown> }> = [];
        let match;

        while ((match = toolCallRegex.exec(responseContent)) !== null) {
          try {
            const toolCallJson = match[1].trim();
            const toolCall = JSON.parse(toolCallJson);
            if (toolCall.tool) {
              toolCallsInResponse.push({
                tool: toolCall.tool,
                args: toolCall.args || {},
              });
            }
          } catch (parseError) {
            logger.error('Failed to parse tool call', parseError);
          }
        }

        // If no tool calls, we're done - this is the final response
        if (toolCallsInResponse.length === 0) {
          finalResponse = responseContent;
          break;
        }

        // Execute all tool calls in this turn
        const turnResults: Array<{ tool: string; args: Record<string, unknown>; result: unknown; success: boolean }> = [];

        for (const toolCall of toolCallsInResponse) {
          if (hasHandler(toolCall.tool)) {
            logger.info(`Executing tool: ${toolCall.tool}`);
            try {
              const result = await executeHandler(toolCall.tool, toolCall.args, handlerContext);

              // Check if the result indicates an error (even if no exception was thrown)
              const isErrorResult = checkForErrorInResult(result);

              if (isErrorResult.hasError) {
                turnResults.push({
                  tool: toolCall.tool,
                  args: toolCall.args,
                  result: { error: isErrorResult.errorMessage, originalResult: result },
                  success: false,
                });
                logger.error(`Tool ${toolCall.tool} returned error: ${isErrorResult.errorMessage}`);
              } else {
                turnResults.push({
                  tool: toolCall.tool,
                  args: toolCall.args,
                  result,
                  success: true,
                });
                logger.info(`Tool ${toolCall.tool} executed successfully`);
              }
            } catch (toolError) {
              const errorMsg = toolError instanceof Error ? toolError.message : 'Unknown error';
              turnResults.push({
                tool: toolCall.tool,
                args: toolCall.args,
                result: { error: errorMsg },
                success: false,
              });
              logger.error(`Tool ${toolCall.tool} failed: ${errorMsg}`);
            }
          } else {
            logger.info(`[WARN] Unknown tool requested: ${toolCall.tool}`);
            turnResults.push({
              tool: toolCall.tool,
              args: toolCall.args,
              result: { error: `Unknown tool: ${toolCall.tool}` },
              success: false,
            });
          }
        }

        allToolsExecuted.push(...turnResults);

        // Build result message to send back to Claude
        const hasFailures = turnResults.some(r => !r.success);

        let toolResultMessage = 'Tool execution results:\n\n';
        for (const exec of turnResults) {
          if (exec.success) {
            toolResultMessage += `\u2705 ${exec.tool} completed successfully:\n`;
            toolResultMessage += '```json\n' + JSON.stringify(exec.result, null, 2) + '\n```\n\n';
          } else {
            const errorResult = exec.result as { error?: string; originalResult?: unknown };
            toolResultMessage += `\u274c ${exec.tool} FAILED: ${errorResult.error || 'Unknown error'}\n`;
            if (errorResult.originalResult) {
              toolResultMessage += 'Original response: ' + JSON.stringify(errorResult.originalResult) + '\n\n';
            }
          }
        }

        // CRITICAL: Different instructions based on success/failure
        if (hasFailures) {
          toolResultMessage += '\n\u26a0\ufe0f **CRITICAL: One or more tools FAILED. You MUST:**\n';
          toolResultMessage += '1. STOP - Do NOT continue to the next operation\n';
          toolResultMessage += '2. ANALYZE the error message above\n';
          toolResultMessage += '3. FIX the issue (correct parameters, get required IDs first, etc.)\n';
          toolResultMessage += '4. RETRY the failed tool with corrected arguments\n';
          toolResultMessage += '5. Only proceed after the tool succeeds\n\n';
          toolResultMessage += 'DO NOT report success or continue if a tool failed. Fix it first!';
        } else {
          toolResultMessage += '\nAll tools completed successfully. You may continue with the next steps or provide a summary.';
        }

        // Add assistant response and tool results to conversation
        conversationMessages.push({ role: 'assistant', content: responseContent });
        conversationMessages.push({ role: 'user', content: toolResultMessage });

        // Store the response content (with tool calls) for the final output
        finalResponse = responseContent;
      }

      // Format the final response
      let responseContent = finalResponse;

      // If tools were executed, append a summary
      if (allToolsExecuted.length > 0) {
        // Remove tool_call blocks from the response
        responseContent = responseContent.replace(/```tool_call\s*\n[\s\S]*?\n```/g, '');

        responseContent += '\n\n---\n**Tool Execution Results:**\n';
        for (const exec of allToolsExecuted) {
          if (exec.success) {
            responseContent += `\n\u2705 **${exec.tool}** completed successfully\n`;
            // Show relevant result info
            if (exec.result && typeof exec.result === 'object') {
              const r = exec.result as Record<string, unknown>;
              if (r.id) responseContent += `   - ID: \`${r.id}\`\n`;
              if (r.name) responseContent += `   - Name: ${r.name}\n`;
              if (r.message) responseContent += `   - ${r.message}\n`;
              // Show project details
              if (r.project && typeof r.project === 'object') {
                const p = r.project as Record<string, unknown>;
                if (p.id) responseContent += `   - Project ID: \`${p.id}\`\n`;
                if (p.name) responseContent += `   - Project Name: ${p.name}\n`;
              }
              // Show suite details
              if (r.suite && typeof r.suite === 'object') {
                const s = r.suite as Record<string, unknown>;
                if (s.id) responseContent += `   - Suite ID: \`${s.id}\`\n`;
                if (s.name) responseContent += `   - Suite Name: ${s.name}\n`;
              }
              // Show test details
              if (r.test && typeof r.test === 'object') {
                const t = r.test as Record<string, unknown>;
                if (t.id) responseContent += `   - Test ID: \`${t.id}\`\n`;
                if (t.name) responseContent += `   - Test Name: ${t.name}\n`;
              }
            }
          } else {
            const errorResult = exec.result as { error?: string };
            responseContent += `\n\u274c **${exec.tool}** failed: ${errorResult.error || 'Unknown error'}\n`;
          }
        }
      }

      const toolsExecuted = allToolsExecuted;

      const executionTime = Date.now() - startTime;

      // Feature #1941: Calculate estimated cost based on model used
      const inputTokens = lastAiResponse.inputTokens || 0;
      const outputTokens = lastAiResponse.outputTokens || 0;
      const modelUsed = lastAiResponse.model || selectedModel;

      // Cost rates per million tokens (approximate)
      const isHaiku = modelUsed.includes('haiku');
      const inputCostPerM = isHaiku ? 0.075 : 0.90;  // Haiku vs Sonnet
      const outputCostPerM = isHaiku ? 0.375 : 4.50;  // Haiku vs Sonnet

      const estimatedCostUsd = (
        (inputTokens / 1_000_000) * inputCostPerM +
        (outputTokens / 1_000_000) * outputCostPerM
      );

      // Calculate savings: what it would cost on Sonnet vs what was actually paid
      const sonnetCostUsd = (
        (inputTokens / 1_000_000) * 0.90 +
        (outputTokens / 1_000_000) * 4.50
      );
      const savingsUsd = sonnetCostUsd - estimatedCostUsd;
      const savingsPercent = sonnetCostUsd > 0 ? (savingsUsd / sonnetCostUsd) * 100 : 0;

      logger.info(`Chat completed in ${executionTime}ms using ${lastAiResponse.actualProvider || 'AI'} (${toolsExecuted.length} tools executed, model: ${modelUsed}, complexity: ${complexity})`);

      return reply.send({
        success: true,
        result: {
          response: responseContent.trim(),
          tools_executed: toolsExecuted.length > 0 ? toolsExecuted : undefined,
          ai_metadata: {
            used_real_ai: true,
            provider: lastAiResponse.actualProvider,
            model: lastAiResponse.model,
            complexity,  // Feature #1941: Include complexity level
            tokens: {
              input: lastAiResponse.inputTokens,
              output: lastAiResponse.outputTokens,
            },
            // Feature #1941: Cost tracking
            cost: {
              estimated_usd: Number(estimatedCostUsd.toFixed(6)),
              savings_usd: Number(savingsUsd.toFixed(6)),
              savings_percent: Number(savingsPercent.toFixed(1)),
            },
          },
        },
        tool_used: toolsExecuted.length > 0 ? toolsExecuted.map(t => t.tool).join(', ') : 'ai_chat',
        metadata: {
          used_real_ai: true,
          provider: lastAiResponse.actualProvider,
          model: lastAiResponse.model,
          complexity,  // Feature #1941
          execution_time_ms: executionTime,
          tools_called: toolsExecuted.length,
        },
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Chat failed: ${errorMessage}`, error);

      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', errorMessage, { execution_time_ms: executionTime });
    }
  });
}
