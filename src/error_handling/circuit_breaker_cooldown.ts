import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
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
 * Circuit Breaker (Cooldown) Error Handling Example
 *
 * This template demonstrates the circuit breaker pattern, which prevents
 * repeated attempts on persistently failing nodes. After consecutive failures,
 * the node enters a "cooldown" period and is temporarily skipped.
 *
 * Key Features:
 * - Circuit breaker opens after N consecutive failures
 * - Node is skipped during cooldown period
 * - Automatic recovery with "half-open" state for testing
 * - Success resets the circuit breaker
 *
 * Circuit Breaker States:
 * 1. CLOSED (Normal): Node executes normally
 * 2. OPEN (Cooldown): Node is skipped, routes to fallback if available
 * 3. HALF-OPEN (Testing): After cooldown expires, one attempt is allowed
 *    - If success: Circuit breaker resets to CLOSED
 *    - If failure: Returns to OPEN state
 *
 * Error Handling Flow:
 * 1. Track consecutive failures per node
 * 2. After min_consecutive_failures -> enter cooldown
 * 3. During cooldown -> skip node execution
 * 4. After cooldown_duration -> enter half-open state
 * 5. One test execution in half-open state
 * 6. Success -> reset to closed, Failure -> back to open
 *
 * @example
 * # Run normally (success case)
 * npm run error-handling-circuit-breaker "Tell me about AI"
 *
 * # To test circuit breaker behavior, you would need to:
 * # 1. Configure a node that fails consistently
 * # 2. Execute multiple times to trigger cooldown
 * # 3. Wait for cooldown period
 * # 4. Execute again to test half-open state
 */

const usage = `
Usage:
    npm run error-handling-circuit-breaker "Your prompt here" --  \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}]

Examples:
    # Basic circuit breaker example
    npm run error-handling-circuit-breaker "Explain circuit breakers"
    
    # In production, circuit breaker activates after repeated failures
    npm run error-handling-circuit-breaker "Test" -- --modelName="invalid-model"
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  console.log('Circuit Breaker (Cooldown) Error Handling Example');
  console.log('==================================================\n');
  console.log('Configuration:');
  console.log('  - Min consecutive failures: 2');
  console.log('  - Cooldown duration: 10000ms (10 seconds)');
  console.log('  - Fallback node available during cooldown\n');
  console.log('Circuit Breaker States:');
  console.log('  1. CLOSED (Normal) - Node executes normally');
  console.log('  2. OPEN (Cooldown) - Node skipped, uses fallback');
  console.log('  3. HALF-OPEN (Testing) - One test attempt after cooldown\n');

  // Fallback node - used when primary is in cooldown
  const fallbackNode = new RemoteLLMCompletionNode({
    id: 'fallback_completion',
    provider: 'openai',
    modelName: 'gpt-4o-mini',
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
  });

  // Error handling configuration with proper types
  const errorHandling = {
    // Circuit breaker configuration
    cooldown: {
      minConsecutiveFailures: 2, // Open circuit after 2 consecutive failures
      cooldownDuration: 10000, // 10000ms = 10 seconds (can also use '10s')
    },
    // Fallback during cooldown
    fallbacks: [
      {
        nodeId: 'fallback_completion',
        handleErrors: [
          ErrorStatusCode.Unavailable,
          ErrorStatusCode.Internal,
          ErrorStatusCode.DeadlineExceeded,
        ],
      },
    ],
  };

  // Primary node with circuit breaker configuration
  const primaryNode = new RemoteLLMCompletionNode({
    id: 'primary_completion',
    provider,
    modelName,
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
    errorHandling,
  });

  const graph = new GraphBuilder({
    id: 'circuit_breaker_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(primaryNode)
    .addNode(fallbackNode)
    .setStartNode(primaryNode)
    .setEndNode(primaryNode)
    .build();

  console.log('Sending prompt:', prompt);
  console.log('Executing with circuit breaker...\n');

  const { outputStream } = await graph.start(prompt);

  for await (const result of outputStream) {
    await result.processResponse({
      string: (text: string) => {
        console.log('Result:', text);
      },
      Content: (content: GraphTypes.Content) => {
        console.log('Result:', content.content);
      },
      error: (error: GraphTypes.GraphError) => {
        console.error('Error:', error.code, '-', error.message);
      },
    });
  }

  stopInworldRuntime();
}
