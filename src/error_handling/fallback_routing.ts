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
 * Fallback Routing Error Handling Example
 *
 * This template demonstrates how to configure fallback nodes that are used
 * when the primary node fails. Fallbacks provide resilience by routing to
 * alternative implementations.
 *
 * Key Features:
 * - Primary node fails -> automatically routes to fallback node
 * - Fallbacks are stateful and persist across executions
 * - Multiple fallbacks can be configured in priority order
 * - Error-specific fallback routing based on error codes
 *
 * Error Handling Flow:
 * 1. Primary node executes
 * 2. On failure, check if error matches fallback's handle_errors
 * 3. If matched, execute fallback node instead
 * 4. If fallback succeeds, return result under primary node ID
 * 5. If no fallback matches or all fail, return error
 *
 * @example
 * # Run with default settings (uses primary node)
 * yarn error-handling-fallback "Tell me a joke"
 *
 * # Test fallback with invalid primary model (will use backup)
 * yarn error-handling-fallback "Hello" --modelName="invalid-model-name"
 */

const usage = `
Usage:
    yarn error-handling-fallback "Your prompt here" \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}]

Examples:
    # Basic fallback example
    yarn error-handling-fallback "Complete this: AI is"
    
    # Test fallback by using invalid model name (demonstrates routing)
    yarn error-handling-fallback "Test" --modelName="invalid-model"
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  console.log('Fallback Routing Error Handling Example');
  console.log('========================================\n');
  console.log('Configuration:');
  console.log('  - Primary node: Configured model');
  console.log('  - Fallback node: Alternative model (gpt-4o-mini)');
  console.log(
    '  - Fallback triggers on: UNAVAILABLE, INTERNAL, DEADLINE_EXCEEDED\n',
  );

  // Fallback node - uses a reliable fallback model
  const fallbackNode = new RemoteLLMCompletionNode({
    id: 'fallback_completion',
    provider: 'openai',
    modelName: 'gpt-4o-mini', // Reliable fallback model
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 50,
    },
  });

  const errorHandling: ErrorHandlingConfig = {
    fallbacks: [
      {
        nodeId: 'fallback_completion',
        handleErrors: [
          ErrorStatusCode.Unavailable,
          ErrorStatusCode.Internal,
          ErrorStatusCode.DeadlineExceeded,
        ],
        // Optional: Override default ignore_errors
        // ignoreErrors: [], // Don't ignore any errors for this fallback
      },
    ],
  };

  // Primary node with fallback configuration
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
    id: 'fallback_routing_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(primaryNode)
    .addNode(fallbackNode)
    .setStartNode(primaryNode)
    .setEndNode(primaryNode) // End node is still primary (fallback result returned under primary ID)
    .build();

  console.log('Sending prompt:', prompt);
  console.log('Executing with fallback routing...\n');

  const { outputStream } = await graph.start(prompt);

  for await (const result of outputStream) {
    await result.processResponse({
      string: (text: string) => {
        console.log('Success');
        console.log('Result:', text);
        console.log('\nNote: Result may be from primary or fallback node');
      },
      Content: (content: GraphTypes.Content) => {
        console.log('Success');
        console.log('Result:', content.content);
        console.log('\nNote: Result may be from primary or fallback node');
      },
      default: (data: any) => {
        console.log('Other response:', data);
      },
      error: (error: GraphTypes.GraphError) => {
        console.error('Error (both primary and fallback failed):');
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        console.error(
          '\nNote: This means both the primary and fallback nodes failed,',
        );
        console.error(
          "   or the error was not in the fallback's handle_errors list.",
        );
      },
    });
  }

  console.log('\nExample completed');
  stopInworldRuntime();
}
