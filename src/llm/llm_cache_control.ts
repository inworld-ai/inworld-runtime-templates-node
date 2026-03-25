import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  LLMChatRequest,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';
import { Message } from '@inworld/runtime/primitives/llm';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
} from '../shared/constants';
import { exitWithError } from '../shared/helpers/cli_helpers';

const minimist = require('minimist');

const usage = `
Usage:
    npm run llm-cache-control "Hello, what can you help me with?" -- \\
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \\
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \\
    --cacheType=<ephemeral|persistent>[optional, default=ephemeral] \\
    --ttl=<duration>[optional, cache TTL e.g. "300s"] \\
    --cacheId=<id>[optional, explicit cache identifier]

Examples:
    npm run llm-cache-control "Summarize the system prompt"
    npm run llm-cache-control "Hello" -- --cacheType=ephemeral
    npm run llm-cache-control "Continue" -- --cacheId=my-session --ttl=600s
`;

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    exitWithError(usage);
  }

  const prompt = argv._.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || process.env.API_KEY || '';
  const cacheType = argv.cacheType || 'ephemeral';
  const ttl = argv.ttl || undefined;
  const cacheId = argv.cacheId || undefined;

  if (!prompt) {
    exitWithError(`You need to provide a prompt.\n${usage}`, 1);
  }
  if (!apiKey) {
    exitWithError(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      1,
    );
  }

  return { prompt, modelName, provider, apiKey, cacheType, ttl, cacheId };
}

run();

async function run() {
  const { prompt, modelName, provider, apiKey, cacheType, ttl, cacheId } =
    parseArgs();

  console.log('\n=== LLM Cache Control Example ===');
  console.log(`Model: ${provider}/${modelName}`);
  console.log(`Cache type: ${cacheType}`);
  if (ttl) console.log(`Cache TTL: ${ttl}`);
  if (cacheId) console.log(`Cache ID: ${cacheId}`);
  console.log();

  const llmNode = new RemoteLLMChatNode({
    id: 'llm',
    stream: false,
    modelId: `${provider}/${modelName}`,
  });

  const graph = new GraphBuilder({
    id: 'llm_cache_control_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .setStartNode(llmNode)
    .setEndNode(llmNode)
    .build();

  const cacheControl = {
    type: cacheType,
    ...(ttl ? { ttl } : {}),
    ...(cacheId ? { cacheId } : {}),
  };

  const systemMessage: Message = {
    role: 'system',
    content:
      'You are a knowledgeable assistant specializing in science and technology. ' +
      'Always provide detailed, well-structured responses with examples when possible. ' +
      'This is a large system prompt that benefits from caching to reduce token costs ' +
      'on subsequent requests within the same session.',
    toolCallId: '',
    cacheControl,
  };

  const userMessage: Message = {
    role: 'user',
    content: prompt,
    toolCallId: '',
  };

  console.log(
    'Cache control applied to system message:',
    JSON.stringify(cacheControl),
  );
  console.log('Sending request...\n');

  const graphInput = new GraphTypes.LLMChatRequest({
    messages: [systemMessage, userMessage],
  } as LLMChatRequest);

  const { outputStream } = await graph.start(graphInput);

  for await (const result of outputStream) {
    await result.processResponse({
      string: (text: string) => {
        console.log('Response:', text);
      },
      Content: (response: GraphTypes.Content) => {
        console.log('Response:', response.content);

        if (response.usage) {
          console.log('\nToken usage:');
          console.log(`  Prompt tokens: ${response.usage.promptTokens || 0}`);
          console.log(
            `  Completion tokens: ${response.usage.completionTokens || 0}`,
          );
          if (response.usage.promptTokensDetails) {
            console.log(
              '  Prompt token details:',
              JSON.stringify(response.usage.promptTokensDetails),
            );
          }
        }

        if (response.finishReason) {
          console.log(`Finish reason: ${response.finishReason}`);
        }
      },
      error: (error: GraphTypes.GraphError) => {
        console.error('Error:', error.code, '-', error.message);
      },
    });
  }

  console.log('\nExample completed');
  stopInworldRuntime();
}
