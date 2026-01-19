import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { LLMChatRequest } from '@inworld/runtime/graph';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';
import { ResponseFormat } from '@inworld/runtime/primitives/llm';
const minimist = require('minimist');

interface ModelSelectorInput {
  prompt: string;
  useModelB: boolean;
}

class SharedRequestBuilderNode extends CustomNode {
  process(
    _context: ProcessContext,
    input: ModelSelectorInput,
  ): { llmRequest: LLMChatRequest; useModelB: boolean } {
    const llmRequestData: LLMChatRequest = {
      messages: [{ role: 'user', content: input.prompt }],
      responseFormat: ResponseFormat.Text,
    };
    return {
      llmRequest: llmRequestData,
      useModelB: input.useModelB,
    };
  }
}

class LLMRequestFilterNode extends CustomNode {
  process(
    _context: ProcessContext,
    input: { llmRequest: LLMChatRequest; useModelB: boolean },
  ): GraphTypes.LLMChatRequest {
    // Filter out useModelB and pass only the LLM request to the LLM node
    return new GraphTypes.LLMChatRequest(input.llmRequest);
  }
}

class ResponseProcessorNode extends CustomNode {
  process(_context: ProcessContext, input: GraphTypes.Content): string {
    return `Response from selected model: ${input.content}`;
  }
}

const usage = `
Usage:
    npm run model-selector-conditional "Your prompt here" -- --useModelB

    --useModelB[optional, if provided uses modelB, otherwise uses modelA]
    --modelA=<model-name>[optional, default=gpt-4o-mini]
    --modelB=<model-name>[optional, default=gpt-4o]
    --provider=<service-provider>[optional, default=openai]

Description:
    This example demonstrates conditional model selection based on a flag.
    If --useModelB is provided, it will use modelB (default: gpt-4o).
    Otherwise, it will use modelA (default: gpt-4o-mini).
    The prompt is sent to the selected model and processed.

Examples:
    # Use modelA (gpt-4o-mini)
    npm run model-selector-conditional "Explain quantum computing in simple terms"

    # Use modelB (gpt-4o)
    npm run model-selector-conditional "Explain quantum computing in simple terms" -- --useModelB

    # Custom models
    npm run model-selector-conditional "Hello world" -- --modelA="gpt-3.5-turbo" --modelB="gpt-4" --useModelB
`;

run();

async function run() {
  const { prompt, modelA, modelB, useModelB, provider, apiKey } =
    parseCustomArgs();

  const modelANode = new RemoteLLMChatNode({
    id: 'model-a-node',
    provider,
    modelName: modelA,
    reportToClient: true,
  });

  const modelBNode = new RemoteLLMChatNode({
    id: 'model-b-node',
    provider,
    modelName: modelB,
    reportToClient: true,
  });

  const sharedRequestBuilder = new SharedRequestBuilderNode();
  const filterNodeA = new LLMRequestFilterNode();
  const filterNodeB = new LLMRequestFilterNode();
  const responseProcessor = new ResponseProcessorNode();

  const graph = new GraphBuilder({
    id: 'model_selector_conditional_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(sharedRequestBuilder)
    .addNode(filterNodeA)
    .addNode(filterNodeB)
    .addNode(modelANode)
    .addNode(modelBNode)
    .addNode(responseProcessor)
    .addEdge(sharedRequestBuilder, filterNodeA, {
      conditionExpression: 'input.useModelB == false',
    })
    .addEdge(sharedRequestBuilder, filterNodeB, {
      conditionExpression: 'input.useModelB == true',
    })
    .addEdge(filterNodeA, modelANode)
    .addEdge(filterNodeB, modelBNode)
    .addEdge(modelANode, responseProcessor)
    .addEdge(modelBNode, responseProcessor)
    .setStartNode(sharedRequestBuilder)
    .setEndNode(responseProcessor)
    .build();

  console.log(`Graph built with dynamic routing between models:`);
  console.log(`  Model A: ${modelA}`);
  console.log(`  Model B: ${modelB}`);
  console.log('');

  async function testModelSelection(prompt: string, useModelB: boolean) {
    console.log(
      `\n=== Testing: "${prompt}" with ${useModelB ? 'Model B' : 'Model A'} ===`,
    );

    const { outputStream } = await graph.start({
      prompt,
      useModelB,
    } as ModelSelectorInput);

    const llmResult = await outputStream.next();
    console.log('\nLLM Response:');
    await llmResult.processResponse({
      Content: (response: GraphTypes.Content) => {
        console.log('  Content:', response.content);
      },
      ContentStream: async (stream: GraphTypes.ContentStream) => {
        console.log('LLM Response Stream:');
        for await (const chunk of stream) {
          if (chunk.content) {
            process.stdout.write(chunk.content);
          }
        }
        console.log('');
      },
      default: (data: unknown) => {
        console.error('Unprocessed response:', data);
      },
    });

    const finalResult = await outputStream.next();
    await finalResult.processResponse({
      Content: (response: GraphTypes.Content) => {
        console.log('\nFinal Response:', response.content);
      },
      default: (data: unknown) => {
        console.log('Final result:', data);
      },
    });
  }

  await testModelSelection(prompt, useModelB);

  console.log('\n\n=== Demonstrating Dynamic Routing ===');
  await testModelSelection('What is 2+2?', false);
  await testModelSelection('What is 3+3?', true);
  stopInworldRuntime();
}

function parseCustomArgs(): {
  prompt: string;
  modelA: string;
  modelB: string;
  useModelB: boolean;
  provider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const prompt = argv._?.join(' ') || '';
  const modelA = argv.modelA || 'gpt-4o-mini';
  const modelB = argv.modelB || 'gpt-4o';
  const useModelB = !!argv.useModelB;
  const provider = argv.provider || 'openai';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { prompt, modelA, modelB, useModelB, provider, apiKey };
}

// Handle process events for clean shutdown
function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
