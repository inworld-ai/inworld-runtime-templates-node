import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  ErrorHandlingConfig,
  ErrorStatusCode,
  GraphBuilder,
  GraphTypes,
  RemoteLLMCompletionNode,
} from '@inworld/runtime/graph';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
} from '../shared/constants';
import { parseArgs } from '../shared/helpers/cli_helpers';

/**
 * Advanced Combined Error Handling Example
 *
 * This template demonstrates all error handling features combined:
 * - Retries (non-stateful, per execution)
 * - Fallbacks (stateful, persist across executions)
 * - Circuit breaker (cooldown to prevent repeated failures)
 *
 * This is a comprehensive example showing how to build resilient systems
 * with multiple layers of error handling.
 *
 * Error Handling Flow (3-tier):
 * 1. RETRIES: First line of defense
 *    - Node fails -> retry up to max_attempts
 *    - Happens within single execution
 *
 * 2. FALLBACKS: Second line of defense
 *    - All retries exhausted -> route to fallback node
 *    - Fallback nodes can have their own error handling
 *    - Results saved under primary node ID
 *
 * 3. CIRCUIT BREAKER: Long-term protection
 *    - Track consecutive failures across executions
 *    - After N failures -> enter cooldown
 *    - Skip node during cooldown, use fallback directly
 *
 * Combined Flow:
 * 1. Check if node in cooldown -> skip to fallback if available
 * 2. Execute node with retries
 * 3. If all retries fail -> report failure, trigger fallback
 * 4. If N consecutive failures -> activate circuit breaker
 * 5. Circuit breaker open -> skip node, use fallback
 * 6. Success -> reset circuit breaker
 *
 * @example
 * # Run with default settings (normal success)
 * npm run error-handling-advanced "Explain machine learning"
 *
 * # Test with invalid model to see full error handling chain
 * npm run error-handling-advanced "Test" -- --modelName="invalid-model"
 */

const usage = `
Usage:
    npm run error-handling-advanced "Your prompt here" --  \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}]

Examples:
    # Complete error handling demonstration
    npm run error-handling-advanced "What is resilient system design?"
    
    # Test error handling chain
    npm run error-handling-advanced "Test" -- --modelName="invalid-model"
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  console.log('Advanced Combined Error Handling Example');
  console.log('=========================================\n');
  console.log('3-Tier Error Handling Configuration:');
  console.log('\n1. RETRIES (Non-stateful):');
  console.log('   - 2 attempts for UNAVAILABLE errors');
  console.log('   - 3 attempts for DEADLINE_EXCEEDED errors');
  console.log('\n2. FALLBACKS (Stateful):');
  console.log('   - Primary fallback: gpt-4o-mini (for UNAVAILABLE, INTERNAL)');
  console.log('   - Secondary fallback: gpt-4o-mini (catch-all)');
  console.log('   - Each fallback has specific cooldown settings');
  console.log('\n3. CIRCUIT BREAKER:');
  console.log('   - Opens after 2 consecutive failures');
  console.log('   - Cooldown: 30s (30 seconds)');
  console.log('   - Per-fallback cooldown overrides available\n');

  // Secondary fallback - last resort
  const secondaryFallbackNode = new RemoteLLMCompletionNode({
    id: 'secondary_fallback',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
  });

  // Error handling for primary fallback node
  const primaryFallbackErrorHandling: ErrorHandlingConfig = {
    retries: [
      {
        maxAttempts: 2,
        handleErrors: [ErrorStatusCode.Internal],
      },
    ],
  };

  // Primary fallback - first alternative
  const primaryFallbackNode = new RemoteLLMCompletionNode({
    id: 'primary_fallback',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
    errorHandling: primaryFallbackErrorHandling,
  });

  // Complete error handling configuration with proper types
  const primaryErrorHandling: ErrorHandlingConfig = {
    // 1. Retry configuration - per error type
    retries: [
      {
        maxAttempts: 2, // Try twice for UNAVAILABLE
        handleErrors: [ErrorStatusCode.Unavailable],
        ignoreErrors: [], // Don't ignore anything for this retry strategy
      },
      {
        maxAttempts: 3, // Try three times for timeouts
        handleErrors: [ErrorStatusCode.DeadlineExceeded],
        ignoreErrors: [],
      },
    ],
    // 2. Fallback configuration - ordered priority
    fallbacks: [
      {
        nodeId: 'primary_fallback',
        handleErrors: [ErrorStatusCode.Unavailable, ErrorStatusCode.Internal],
        // Per-fallback cooldown (overrides common cooldown)
        cooldown: {
          minConsecutiveFailures: 3, // More tolerant for primary fallback
          cooldownDuration: '20s', // String format: 20 seconds
        },
      },
      {
        nodeId: 'secondary_fallback',
        // Empty handleErrors = catch all errors not handled above
        handleErrors: [],
        // Uses common cooldown (defined below)
      },
    ],
    // 3. Circuit breaker - common cooldown for all fallbacks
    cooldown: {
      minConsecutiveFailures: 2, // Open circuit after 2 failures
      cooldownDuration: '30s', // String format: 30 seconds (can also use 30000 for ms)
    },
  };

  // Primary node with full error handling
  const primaryNode = new RemoteLLMCompletionNode({
    id: 'primary_completion',
    provider,
    modelName,
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
    errorHandling: primaryErrorHandling,
  });

  const graph = new GraphBuilder({
    id: 'advanced_error_handling_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(primaryNode)
    .addNode(primaryFallbackNode)
    .addNode(secondaryFallbackNode)
    .setStartNode(primaryNode)
    .setEndNode(primaryNode)
    .build();

  console.log('Sending prompt:', prompt);
  console.log('Executing with full error handling stack...\n');

  const { outputStream } = await graph.start(prompt);

  for await (const result of outputStream) {
    await result.processResponse({
      string: (text: string) => {
        console.log('Success');
        console.log('Result:', text);
        console.log('\nResult path could be:');
        console.log('   - Primary node (direct success or after retries)');
        console.log(
          '   - Primary fallback (primary failed, fallback succeeded)',
        );
        console.log(
          '   - Secondary fallback (both primary and primary fallback failed)',
        );
      },
      Content: (content: GraphTypes.Content) => {
        console.log('Success');
        console.log('Result:', content.content);
        console.log('\nResult path could be:');
        console.log('   - Primary node (direct success or after retries)');
        console.log(
          '   - Primary fallback (primary failed, fallback succeeded)',
        );
        console.log(
          '   - Secondary fallback (both primary and primary fallback failed)',
        );
      },
      default: (data: any) => {
        console.log('Other response:', data);
      },
      error: (error: GraphTypes.GraphError) => {
        console.error('Complete failure (all nodes failed):');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.error('\nFailure sequence:');
        console.error('   1. Primary retries exhausted');
        console.error('   2. Primary fallback failed or in cooldown');
        console.error('   3. Secondary fallback failed or in cooldown');
        console.error('   4. No more fallback options available');
      },
    });
  }

  console.log('\nExample completed');
  console.log('\nError Handling Summary:');
  console.log('   - Multiple retry strategies for different error types');
  console.log('   - Ordered fallback chain with priority');
  console.log('   - Per-fallback cooldown customization');
  console.log('   - Circuit breaker prevents cascading failures');
  console.log('   - Stateful health tracking across executions');
  stopInworldRuntime();
}
