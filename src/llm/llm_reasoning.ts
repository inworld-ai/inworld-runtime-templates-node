import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  LLMChatRequest,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';
import {
  Message,
  ReasoningConfig_Effort,
} from '@inworld/runtime/primitives/llm';

import { DEFAULT_LLM_PROVIDER } from '../shared/constants';
import { exitWithError } from '../shared/helpers/cli_helpers';

const minimist = require('minimist');

const DEFAULT_REASONING_MODEL_NAME = 'o4-mini';

const usage = `
Usage:
    npm run llm-reasoning "Explain step by step how to solve 15 * 27" -- \\
    --modelName=<model-name>[optional, default=${DEFAULT_REASONING_MODEL_NAME}] \\
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \\
    --effort=<NONE|MINIMAL|LOW|MEDIUM|HIGH|XHIGH>[optional, default=MEDIUM] \\
    --maxTokens=<number>[optional, max reasoning tokens] \\
    --exclude[optional, exclude reasoning from response output]

Examples:
    npm run llm-reasoning "What is the square root of 144?"
    npm run llm-reasoning "Explain quantum entanglement" -- --effort=HIGH
    npm run llm-reasoning "Solve 2+2" -- --effort=LOW --maxTokens=100
    npm run llm-reasoning "Think through this carefully: Why is the sky blue?" -- --effort=XHIGH
    npm run llm-reasoning "Simple calculation: 5+3" -- --exclude
`;

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    exitWithError(usage);
  }

  const prompt = argv._.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_REASONING_MODEL_NAME;
  const provider = argv.provider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || process.env.API_KEY || '';
  const effort = argv.effort || 'MEDIUM';
  const maxTokens = argv.maxTokens ? parseInt(argv.maxTokens, 10) : undefined;
  const exclude = argv.exclude === true || argv.exclude === 'true';

  if (!prompt) {
    exitWithError(`You need to provide a prompt.\n${usage}`, 1);
  }
  if (!apiKey) {
    exitWithError(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      1,
    );
  }

  const effortEnum =
    ReasoningConfig_Effort[effort as keyof typeof ReasoningConfig_Effort];
  if (effortEnum === undefined) {
    exitWithError(
      `Invalid effort level: ${effort}. Valid values: ${Object.keys(ReasoningConfig_Effort).join(', ')}\n${usage}`,
      1,
    );
  }

  return {
    prompt,
    modelName,
    provider,
    apiKey,
    effort: effortEnum,
    maxTokens,
    exclude,
  };
}

run();

async function run() {
  const { prompt, modelName, provider, apiKey, effort, maxTokens, exclude } =
    parseArgs();

  console.log('\n=== LLM Reasoning Config Example ===');
  console.log(`Model: ${provider}/${modelName}`);
  console.log(`Reasoning effort: ${effort}`);
  if (maxTokens !== undefined) {
    console.log(`Max reasoning tokens: ${maxTokens}`);
  }
  console.log(`Exclude reasoning from output: ${exclude}`);
  console.log();

  const llmNode = new RemoteLLMChatNode({
    id: 'llm',
    stream: false,
    modelId: `${provider}/${modelName}`,
  });

  const graph = new GraphBuilder({
    id: 'llm_reasoning_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .setStartNode(llmNode)
    .setEndNode(llmNode)
    .build();

  const messages: Message[] = [
    {
      role: 'system',
      content:
        'You are a helpful assistant. Think carefully and explain your reasoning.',
      toolCallId: '',
    },
    {
      role: 'user',
      content: prompt,
      toolCallId: '',
    },
  ];

  const graphInput = new GraphTypes.LLMChatRequest({
    messages,
    textGenerationConfig: {
      reasoning: {
        effort,
        ...(maxTokens !== undefined ? { maxTokens } : {}),
        exclude,
      },
    },
  } as LLMChatRequest);

  console.log('Sending request...\n');
  const { outputStream } = await graph.start(graphInput);

  for await (const result of outputStream) {
    await result.processResponse({
      string: (text: string) => {
        console.log('Response content:', text);
      },
      Content: (response: GraphTypes.Content) => {
        console.log('Response content:', response.content);

        if (response.reasoning) {
          console.log('\nReasoning output:');
          console.log(response.reasoning);
        } else {
          console.log('\nNo reasoning content returned.');
          if (exclude) {
            console.log('(This is expected when --exclude is set)');
          }
        }

        if (response.usage) {
          console.log('\nToken usage:');
          console.log(`  Prompt tokens: ${response.usage.promptTokens || 0}`);
          console.log(
            `  Completion tokens: ${response.usage.completionTokens || 0}`,
          );
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
