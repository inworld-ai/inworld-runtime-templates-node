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

const minimist = require('minimist');

const usage = `
Usage:
    yarn node-llm-chat-routing "Tell me a joke" \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true|false>[optional, default=true, enable/disable streaming] \n
    --fallback=<provider:modelName>[optional, can be specified multiple times]

Examples:
    # Basic request with automatic fallback to gpt-4o
    yarn node-llm-chat-routing "Tell me a joke"

    # Request with custom primary model and multiple fallbacks
    yarn node-llm-chat-routing "What is the capital of France?" --modelName="llama-3.1-70b-versatile" --provider="groq" --fallback="openai:gpt-4o-mini" --fallback="openai:gpt-4o"

    # Non-streaming request
    yarn node-llm-chat-routing "Explain quantum computing" --stream=false
    `;

run();

async function run() {
  const { prompt, modelName, provider, apiKey, stream, fallbackModels } =
    parseArgs();

  console.log('\n=== LLM Chat Routing Node Example ===');
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
    modelId: {
      provider,
      modelName,
    },
    routingConfig: {
      models: fallbackModels,
    },
    stream,
    textGenerationConfig: {
      maxNewTokens: 150,
      temperature: 0.7,
      topP: 0.9,
      repetitionPenalty: 1.0,
    },
  });

  console.log('📤 Sending request...\n');

  const { outputStream } = await graph.start(graphInput);

  let responseReceived = false;

  for await (const result of outputStream) {
    await result.processResponse({
      Content: (response: GraphTypes.Content) => {
        responseReceived = true;
        console.log('📥 LLM Chat Response:');
        console.log('  Content:', response.content);
        console.log('');
      },
      ContentStream: async (stream: GraphTypes.ContentStream) => {
        responseReceived = true;
        console.log('📡 LLM Chat Response Stream:');
        console.log('');
        let streamContent = '';
        let chunkCount = 0;

        for await (const chunk of stream) {
          chunkCount++;
          if (chunk.text) {
            streamContent += chunk.text;
            process.stdout.write(chunk.text);
          }
        }

        console.log('\n');
        console.log(`✓ Total chunks: ${chunkCount}`);
        console.log(
          `✓ Final content length: ${streamContent.length} characters`,
        );
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
  fallbackModels: Array<{ provider: string; modelName: string }>;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const prompt = argv._?.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || '';
  const stream = argv.stream !== undefined ? argv.stream === 'true' : true;

  const fallbackModels: Array<{ provider: string; modelName: string }> = [];
  const fallbackArgs = Array.isArray(argv.fallback)
    ? argv.fallback
    : argv.fallback
      ? [argv.fallback]
      : [];

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
    fallbackModels,
  };
}
