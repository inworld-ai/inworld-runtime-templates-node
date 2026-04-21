import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  EdgeConditionContext,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';

import { parseArgs } from '../../shared/helpers/cli_helpers';

/**
 * Node that stores the LLM-generated number in the DataStore
 * so it can be read by edge conditions via context.
 */
class StoreResultNode extends CustomNode {
  process(context: ProcessContext, input: GraphTypes.Content): string {
    const value = Number(input.content);
    context.dataStore.generatedNumber = value;
    context.dataStore.routingMode = value > 50 ? 'high' : 'low';
    console.log(
      `Template: Stored generatedNumber=${value}, routingMode=${context.dataStore.routingMode}`,
    );
    return input.content ?? '';
  }
}

class HighPathNode extends CustomNode {
  process(_context: ProcessContext, input: string): string {
    return `HIGH path: number ${input} is greater than 50`;
  }
}

class LowPathNode extends CustomNode {
  process(_context: ProcessContext, input: string): string {
    return `LOW path: number ${input} is less or equal to 50`;
  }
}

const prompt = `
Generate a random number between 1 and 100.

# OUTPUT FORMAT
Output *ONLY* the single numeric. Do *NOT* include *ANY* other text, formatting, spaces, or special tokens (like <|eot>). The output must be exactly one number and nothing else.
`;

const usage = `
Usage:
    npm run custom-conditional-edges-with-context
Description:
    Demonstrates edge conditions that read from the DataStore via EdgeConditionContext.
    A node stores the LLM-generated number in the datastore, then edge conditions
    use context.getDatastore() and context.dataStore to route to different paths.
`;

run();

async function run() {
  const { modelName, provider, apiKey } = parseArgs(usage, {
    skipPrompt: true,
  });

  const llmNode = new RemoteLLMChatNode({
    id: 'llm-node',
    provider,
    modelName,
    reportToClient: true,
  });

  const storeResultNode = new StoreResultNode({ id: 'store-result-node' });
  const highPathNode = new HighPathNode();
  const lowPathNode = new LowPathNode();

  const graph = new GraphBuilder({
    id: 'custom_conditional_edges_with_context_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .addNode(storeResultNode)
    .addNode(highPathNode)
    .addNode(lowPathNode)
    .addEdge(llmNode, storeResultNode)
    // Edge condition using context.dataStore (proxy-based access)
    .addEdge(storeResultNode, highPathNode, {
      condition: (_input: any, context: EdgeConditionContext) => {
        return context.dataStore.routingMode === 'high';
      },
    })
    // Edge condition using context.getDatastore().get() (method-based access)
    .addEdge(storeResultNode, lowPathNode, {
      condition: (_input: any, context: EdgeConditionContext) => {
        return context.getDatastore().get('routingMode') === 'low';
      },
    })
    .setStartNode(llmNode)
    .setEndNodes([highPathNode, lowPathNode])
    .build();

  const { outputStream } = await graph.start(
    new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  );

  for await (const result of outputStream) {
    await result.processResponse({
      ContentStream: async (stream: GraphTypes.ContentStream) => {
        let resultText = '';
        for await (const content of stream) {
          resultText += content.content;
        }
        console.log(`Template: LLM result: ${resultText}`);
      },
      Content: (data: GraphTypes.Content) => {
        console.log(`Template: Result: ${data.content}`);
      },
      default: (data: any) => {
        const value = data?.value ?? data;
        console.log(`Template: Custom node result: ${value}`);
      },
      error: (error) => {
        console.error('Graph Error:', error);
      },
    });
  }

  stopInworldRuntime();
}
