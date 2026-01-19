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
 * Basic Retry Error Handling Example
 *
 * This template demonstrates how to configure retry logic for node execution.
 * The node will automatically retry on specific error types before failing.
 *
 * Key Features:
 * - Retry up to 3 times on UNAVAILABLE, DEADLINE_EXCEEDED, and INTERNAL errors
 * - Non-retryable errors (INVALID_ARGUMENT, NOT_FOUND, etc.) fail immediately
 * - Retries happen within a single execution (non-stateful)
 *
 * Error Handling Flow:
 * 1. Node executes
 * 2. If error matches handle_errors -> retry (up to max_attempts)
 * 3. If error is in ignore_errors -> fail immediately
 * 4. If all retries exhausted -> fail with last error
 *
 * @example
 * # Run with default settings
 * npm run error-handling-basic-retry "Complete this sentence: The quick brown"
 *
 * # Test retry behavior with an unavailable model (will retry 3 times)
 * npm run error-handling-basic-retry "Hello" -- --modelName="invalid-model-name"
 *
 * # Use a different provider
 * npm run error-handling-basic-retry "Test" -- --provider="openai"
 */

const usage = `
Usage:
    npm run error-handling-basic-retry "Your prompt here" --  \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}]

Examples:
    # Basic retry example
    npm run error-handling-basic-retry "Complete this: The sky is"
    
    # Test with unavailable model (demonstrates retry)
    npm run error-handling-basic-retry "Test" -- --modelName="invalid-model"
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  console.log('Basic Retry Error Handling Example');
  console.log('===================================\n');
  console.log('Configuration:');
  console.log(
    '  - Retry up to 3 times on UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL',
  );
  console.log('  - Fail immediately on non-retryable errors\n');

  // Error handling configuration with proper types
  const errorHandling: ErrorHandlingConfig = {
    // Retry configuration
    retries: [
      {
        maxAttempts: 3, // Try up to 3 times total (1 initial + 2 retries)
        handleErrors: [
          ErrorStatusCode.Unavailable,
          ErrorStatusCode.Internal,
          ErrorStatusCode.DeadlineExceeded,
        ],
        // ignoreErrors uses default non-retryable errors:
        // INVALID_ARGUMENT, NOT_FOUND, PERMISSION_DENIED,
        // UNAUTHENTICATED, FAILED_PRECONDITION, OUT_OF_RANGE
      },
    ],
  };

  const llmCompletionNode = new RemoteLLMCompletionNode({
    id: 'completion_with_retry',
    provider,
    modelName,
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
    errorHandling,
  });

  const graph = new GraphBuilder({
    id: 'basic_retry_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmCompletionNode)
    .setStartNode(llmCompletionNode)
    .setEndNode(llmCompletionNode)
    .build();

  console.log('Sending prompt:', prompt);
  console.log('Executing with retry logic...\n');

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
