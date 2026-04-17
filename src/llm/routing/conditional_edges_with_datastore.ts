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
 * Node that writes a threshold value to the DataStore,
 * then forwards the LLM chat request.
 */
class SetupNode extends CustomNode {
  process(
    context: ProcessContext,
    input: GraphTypes.LLMChatRequest,
  ): GraphTypes.LLMChatRequest {
    // Store the threshold in the dataStore so edge conditions can read it
    context.getDatastore().set('threshold', 50);
    console.log('DataStore: threshold set to', 50);
    return new GraphTypes.LLMChatRequest(input);
  }
}

class AboveThresholdNode extends CustomNode {
  process(context: ProcessContext, input: GraphTypes.Content): string {
    const threshold = context.getDatastore().get('threshold');
    return `${input.content} is above the threshold (${threshold})`;
  }
}

class BelowOrEqualThresholdNode extends CustomNode {
  process(context: ProcessContext, input: GraphTypes.Content): string {
    const threshold = context.getDatastore().get('threshold');
    return `${input.content} is at or below the threshold (${threshold})`;
  }
}

const prompt = `
Generate a random number between 1 and 100.

# OUTPUT FORMAT
Output *ONLY* the single numeric. Do *NOT* include *ANY* other text, formatting, spaces, or special tokens (like <|eot>). The output must be exactly one number and nothing else.
`;

const usage = `
Usage:
    npm run conditional-edges-with-datastore
Description:
    Demonstrates edge conditions that read from the DataStore.
    A setup node writes a threshold (50) to the DataStore.
    The LLM generates a random number, and edge conditions
    read the threshold from the DataStore to decide routing.
`;

run();

async function run() {
  const { modelName, provider, apiKey } = parseArgs(usage, {
    skipPrompt: true,
  });

  const setupNode = new SetupNode();

  const llmNode = new RemoteLLMChatNode({
    id: 'llm-node',
    provider,
    modelName,
    reportToClient: true,
  });

  const aboveNode = new AboveThresholdNode();
  const belowNode = new BelowOrEqualThresholdNode();

  const graph = new GraphBuilder({
    id: 'conditional_edges_with_datastore_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(setupNode)
    .addNode(llmNode)
    .addNode(aboveNode)
    .addNode(belowNode)
    .addEdge(setupNode, llmNode)
    // Edge condition using proxy-based property access: context.dataStore.threshold
    .addEdge(llmNode, aboveNode, {
      condition: (input: GraphTypes.Content, context: EdgeConditionContext) => {
        const threshold = context.dataStore.threshold;
        console.log(
          `Edge condition (proxy): ${input.content} > ${threshold}?`,
          Number(input.content) > threshold,
        );
        return Number(input.content) > threshold;
      },
    })
    // Edge condition using method-based access: context.getDatastore().get('threshold')
    .addEdge(llmNode, belowNode, {
      condition: (input: GraphTypes.Content, context: EdgeConditionContext) => {
        const threshold = context.getDatastore().get('threshold');
        console.log(
          `Edge condition (method): ${input.content} <= ${threshold}?`,
          Number(input.content) <= threshold,
        );
        return Number(input.content) <= threshold;
      },
    })
    .setStartNode(setupNode)
    .setEndNodes([aboveNode, belowNode])
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

  const llmResult = await outputStream.next();
  console.log('LLM result:', llmResult);

  const customNodeResult = await outputStream.next();
  console.log('Routing result:', customNodeResult);
  console.log('Custom node result:', customNodeResult);
  stopInworldRuntime();
}
