import 'dotenv/config';

import { LLMMessageInterface, stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatRoutingNode,
} from '@inworld/runtime/graph';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
} from '../shared/constants';

type SortMetric =
  | 'SORT_METRIC_CODING'
  | 'SORT_METRIC_INTELLIGENCE'
  | 'SORT_METRIC_LATENCY'
  | 'SORT_METRIC_MATH'
  | 'SORT_METRIC_PRICE'
  | 'SORT_METRIC_THROUGHPUT'
  | 'SORT_METRIC_UNSPECIFIED';

type SortDirection =
  | 'SORT_DIRECTION_ASCENDING'
  | 'SORT_DIRECTION_DESCENDING'
  | 'SORT_DIRECTION_UNSPECIFIED';

type SortCriteria = {
  metric: SortMetric;
  direction?: SortDirection;
};

const minimist = require('minimist');

const usage = `
Usage:
    npm run node-llm-chat-routing "Tell me a joke" -- \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true|false>[optional, default=true, enable/disable streaming] \n
    --temperature=<number>[optional, default=0.7, controls randomness (0.0-2.0)] \n
    --topP=<number>[optional, default=1.0, nucleus sampling threshold (0.0-1.0)] \n
    --fallback=<provider:modelName>[optional, can be specified multiple times] \n
    --auto[optional, use "auto" for automatic model selection] \n
    --models=<provider:modelName>[optional, can be specified multiple times for auto mode] \n
    --sort=<metric>[optional, sort criteria: intelligence, price, latency, throughput, math, coding]

NOTE: This example requires a valid INWORLD_API_KEY environment variable.
The routing node fetches model information from the Inworld API to enable intelligent routing.

Examples:
    # Basic request with automatic fallback to gpt-4o-mini
    npm run node-llm-chat-routing "Tell me a joke"

    # Request with custom primary model and multiple fallbacks
    npm run node-llm-chat-routing "What is the capital of France?" -- --modelName="llama-3.1-70b-versatile" --provider="groq" --fallback="openai:gpt-4o-mini" --fallback="openai:gpt-4o"

    # Non-streaming request
    npm run node-llm-chat-routing "Explain quantum computing" -- --stream=false

    # Auto model selection sorted by intelligence
    npm run node-llm-chat-routing "What is AI?" -- --auto --models="openai:gpt-4o" --models="openai:gpt-4o-mini" --models="groq:llama-3.3-70b-versatile" --sort=intelligence

    # Auto model selection sorted by price
    npm run node-llm-chat-routing "Tell me a joke" -- --auto --models="openai:gpt-4o" --models="openai:gpt-4o-mini" --sort=price
    `;

run();

async function run() {
  const {
    prompt,
    modelName,
    provider,
    apiKey,
    stream,
    temperature,
    topP,
    fallbackModels,
    autoMode,
    sortCriteria,
  } = parseArgs();

  console.log('\n=== LLM Chat Routing Node Example ===');

  if (autoMode) {
    console.log(
      'This example demonstrates automatic model selection with intelligent routing.',
    );
    console.log('Mode: Auto model selection');
    console.log('Available models:');
    fallbackModels.forEach((model, idx) => {
      console.log(`  ${idx + 1}. ${model.provider}/${model.modelName}`);
    });
    if (sortCriteria.length > 0) {
      console.log(
        'Sort criteria:',
        sortCriteria
          .map((c) => c.metric.replace('SORT_METRIC_', '').toLowerCase())
          .join(', '),
      );
    }
  } else {
    console.log(
      'This example demonstrates intelligent LLM routing with automatic fallback.',
    );
    console.log(`Primary model: ${provider}/${modelName}`);
    if (fallbackModels.length > 0) {
      console.log('Fallback models:');
      fallbackModels.forEach((model, idx) => {
        console.log(`  ${idx + 1}. ${model.provider}/${model.modelName}`);
      });
    } else {
      console.log('No fallback models configured (using default)');
    }
  }
  console.log('');

  const llmRoutingNode = new RemoteLLMChatRoutingNode({
    id: 'llm-routing-node',
    defaultTimeout: 30,
  });

  const graph = new GraphBuilder({
    id: 'llm_chat_routing_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(llmRoutingNode)
    .setStartNode(llmRoutingNode)
    .setEndNode(llmRoutingNode)
    .build();

  const messages: LLMMessageInterface[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ];

  const graphInput = new GraphTypes.LLMChatRoutingRequest({
    messages,
    modelId: autoMode
      ? {
          provider: 'auto',
          modelName: 'auto',
        }
      : {
          provider,
          modelName,
        },
    modelSelection: {
      models: fallbackModels,
      sort: sortCriteria.length > 0 ? sortCriteria : undefined,
    },
    textGenerationConfig: {
      temperature,
      topP,
    },
    stream,
  });

  console.log('📤 Sending request...\n');

  const { outputStream } = await graph.start(graphInput);

  let responseReceived = false;

  for await (const result of outputStream) {
    await result.processResponse({
      Content: (response: GraphTypes.Content) => {
        responseReceived = true;
        console.log('📥 LLM Chat Response:');
        console.log(response.content);
        console.log('');
        if (response.finishReason) {
          console.log(`✓ Finish Reason: ${response.finishReason}`);
        }
        if (response.modelName) {
          console.log(`✓ Model Name: ${response.modelName}`);
        }
        if (response.usage) {
          console.log(`✓ Token Usage:`);
          console.log(`  - Prompt Tokens: ${response.usage.promptTokens || 0}`);
          console.log(
            `  - Completion Tokens: ${response.usage.completionTokens || 0}`,
          );
        }
        console.log('');
      },
      // LLMChatResponse includes metadata from routing decisions
      LLMChatResponse: (response: GraphTypes.LLMChatResponse) => {
        responseReceived = true;
        console.log('📥 LLM Chat Routing Response:');
        console.log(response.content);
        console.log('');

        // Display routing metadata (only populated by LLMChatRoutingNode)
        if (response.metadata) {
          console.log('📊 Routing Metadata:');

          // Generation ID - unique identifier for this request
          if (response.metadata.generationId) {
            console.log(`  • Generation ID: ${response.metadata.generationId}`);
          }

          // Routing reasoning - explanation of model selection
          if (response.metadata.reasoning) {
            console.log(
              `  • Routing Reasoning: ${response.metadata.reasoning}`,
            );
          }

          // Total duration - time from request to response
          if (response.metadata.totalDurationMs !== undefined) {
            console.log(
              `  • Total Duration: ${response.metadata.totalDurationMs}ms`,
            );
          }

          // Attempt details - information about each model attempt
          if (
            response.metadata.attempts &&
            response.metadata.attempts.length > 0
          ) {
            console.log('  • Model Attempts:');
            response.metadata.attempts.forEach((attempt, idx) => {
              const status = attempt.success ? '✅' : '❌';
              const modelId = attempt.modelId
                ? `${attempt.modelId.provider}/${attempt.modelId.modelName}`
                : 'unknown';
              console.log(`    ${idx + 1}. ${status} ${modelId}`);
              if (attempt.timeToFirstTokenMs !== undefined) {
                console.log(
                  `       Time to First Token: ${attempt.timeToFirstTokenMs}ms`,
                );
              }
              if (attempt.errorMessage) {
                console.log(`       Error: ${attempt.errorMessage}`);
              }
              if (attempt.warnings && attempt.warnings.length > 0) {
                console.log(`       Warnings: ${attempt.warnings.join(', ')}`);
              }
            });
          }
        }
        console.log('');

        if (response.finishReason) {
          console.log(`✓ Finish Reason: ${response.finishReason}`);
        }
        if (response.modelName) {
          console.log(`✓ Model Name: ${response.modelName}`);
        }
        if (response.usage) {
          console.log(`✓ Token Usage:`);
          console.log(`  - Prompt Tokens: ${response.usage.promptTokens || 0}`);
          console.log(
            `  - Completion Tokens: ${response.usage.completionTokens || 0}`,
          );
        }
        console.log('');
      },
      ContentStream: async (stream: GraphTypes.ContentStream) => {
        responseReceived = true;
        console.log('📡 LLM Chat Response Stream:');

        // Access routing metadata from stream (if available)
        const metadata = (stream as any).metadata as
          | {
              attempts?: Array<{
                modelId?: { provider: string; modelName: string };
                success?: boolean;
                errorMessage?: string;
                timeToFirstTokenMs?: number;
                warnings?: string[];
              }>;
              generationId?: string;
              reasoning?: string;
              totalDurationMs?: number;
            }
          | undefined;

        if (metadata) {
          console.log('📊 Routing Metadata:');
          if (metadata.generationId) {
            console.log(`  • Generation ID: ${metadata.generationId}`);
          }
          if (metadata.reasoning) {
            console.log(`  • Routing Reasoning: ${metadata.reasoning}`);
          }
          if (metadata.attempts && metadata.attempts.length > 0) {
            const failedAttempts = metadata.attempts.filter((a) => !a.success);
            if (failedAttempts.length > 0) {
              console.log('  ⚠️  Failed attempts before success:');
              failedAttempts.forEach((attempt, idx) => {
                const modelId = attempt.modelId
                  ? `${attempt.modelId.provider}/${attempt.modelId.modelName}`
                  : 'unknown';
                console.log(
                  `    ${idx + 1}. ${modelId}: ${attempt.errorMessage}`,
                );
              });
            }
          }
        }
        console.log('');

        let streamContent = '';
        let chunkCount = 0;
        let lastFinishReason: any = undefined;
        let lastUsage: any = undefined;
        let lastModelName: string | undefined = undefined;

        for await (const chunk of stream) {
          chunkCount++;
          if (chunk.text) {
            streamContent += chunk.text;
            process.stdout.write(chunk.text);
          }
          if (chunk.finishReason !== undefined) {
            lastFinishReason = chunk.finishReason;
          }
          if (chunk.usage !== undefined) {
            lastUsage = chunk.usage;
          }
          if (chunk.modelName !== undefined) {
            lastModelName = chunk.modelName;
          }
        }

        console.log('\n');
        console.log(`✓ Total chunks: ${chunkCount}`);
        console.log(
          `✓ Final content length: ${streamContent.length} characters`,
        );
        if (lastFinishReason !== undefined) {
          console.log(`✓ Finish Reason: ${lastFinishReason}`);
        }
        if (lastModelName !== undefined) {
          console.log(`✓ Model Name: ${lastModelName}`);
        }
        if (lastUsage !== undefined) {
          console.log(`✓ Token Usage:`);
          console.log(`  - Prompt Tokens: ${lastUsage.promptTokens || 0}`);
          console.log(
            `  - Completion Tokens: ${lastUsage.completionTokens || 0}`,
          );
        }
        if (metadata?.totalDurationMs !== undefined) {
          console.log(`✓ Total Duration: ${metadata.totalDurationMs}ms`);
        }
        console.log('');
      },
      error: (error: GraphTypes.GraphError) => {
        console.error('❌ Error:', error.message);
        throw new Error(error.message);
      },
      default: (data: any) => {
        console.error('⚠️  Unprocessed response:', data);
      },
    });
  }

  if (!responseReceived) {
    console.log('[No response received - all models may have failed]');
  }

  stopInworldRuntime();
}

function parseArgs(): {
  prompt: string;
  modelName: string;
  provider: string;
  apiKey: string;
  stream: boolean;
  temperature: number;
  topP: number;
  fallbackModels: Array<{ provider: string; modelName: string }>;
  autoMode: boolean;
  sortCriteria: SortCriteria[];
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const prompt = argv._?.join(' ') || '';
  const autoMode = argv.auto === true;
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || '';
  const stream = argv.stream !== undefined ? argv.stream === 'true' : true;
  const temperature =
    argv.temperature !== undefined ? parseFloat(argv.temperature) : 0.7;
  const topP = argv.topP !== undefined ? parseFloat(argv.topP) : 1.0;

  // Parse sort criteria
  const sortCriteria: SortCriteria[] = [];
  const sortArgs = Array.isArray(argv.sort)
    ? argv.sort
    : argv.sort
      ? [argv.sort]
      : [];

  for (const sort of sortArgs) {
    const metric = sort.toUpperCase();
    let metricValue: SortMetric;

    switch (metric) {
      case 'INTELLIGENCE':
        metricValue = 'SORT_METRIC_INTELLIGENCE';
        break;
      case 'PRICE':
        metricValue = 'SORT_METRIC_PRICE';
        break;
      case 'LATENCY':
        metricValue = 'SORT_METRIC_LATENCY';
        break;
      case 'THROUGHPUT':
        metricValue = 'SORT_METRIC_THROUGHPUT';
        break;
      case 'MATH':
        metricValue = 'SORT_METRIC_MATH';
        break;
      case 'CODING':
        metricValue = 'SORT_METRIC_CODING';
        break;
      default:
        console.warn(
          `Warning: Unknown sort metric: ${sort}. Defaulting to INTELLIGENCE.`,
        );
        metricValue = 'SORT_METRIC_INTELLIGENCE';
    }

    sortCriteria.push({
      metric: metricValue,
    });
  }

  const fallbackModels: Array<{ provider: string; modelName: string }> = [];

  const modelArgs = autoMode
    ? Array.isArray(argv.models)
      ? argv.models
      : argv.models
        ? [argv.models]
        : []
    : [];

  const fallbackArgs = !autoMode
    ? Array.isArray(argv.fallback)
      ? argv.fallback
      : argv.fallback
        ? [argv.fallback]
        : []
    : [];

  if (autoMode) {
    for (const model of modelArgs) {
      const [modelProvider, modelModelName] = model.split(':');
      if (modelProvider && modelModelName) {
        fallbackModels.push({
          provider: modelProvider,
          modelName: modelModelName,
        });
      } else {
        console.warn(
          `Warning: Invalid model format: ${
            model
          }. Expected format: provider:modelName`,
        );
      }
    }

    if (fallbackModels.length === 0) {
      // Default models for auto mode
      fallbackModels.push(
        { provider: 'openai', modelName: 'gpt-4o' },
        { provider: 'openai', modelName: 'gpt-4o-mini' },
        { provider: 'groq', modelName: 'llama-3.3-70b-versatile' },
      );
    }
  } else {
    // Parse fallback models for normal mode
    for (const fallback of fallbackArgs) {
      const [fbProvider, fbModelName] = fallback.split(':');
      if (fbProvider && fbModelName) {
        fallbackModels.push({
          provider: fbProvider,
          modelName: fbModelName,
        });
      } else {
        console.warn(
          `Warning: Invalid fallback format: ${
            fallback
          }. Expected format: provider:modelName`,
        );
      }
    }

    if (fallbackModels.length === 0) {
      fallbackModels.push({
        provider: 'openai',
        modelName: 'gpt-4.1-mini',
      });
    }
  }

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    prompt,
    modelName,
    provider,
    apiKey,
    stream,
    temperature,
    topP,
    fallbackModels,
    autoMode,
    sortCriteria,
  };
}
