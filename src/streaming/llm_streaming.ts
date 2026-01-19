import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';

import { parseArgs } from '../shared/helpers/cli_helpers';

class CustomStreamReaderNode extends CustomNode {
  async process(
    _context: ProcessContext,
    contentStream: GraphTypes.ContentStream,
  ): Promise<string> {
    console.log('CustomStreamReaderNode', contentStream);
    let result = '';
    for await (const chunk of contentStream) {
      if (chunk.content) result += chunk.content;
    }
    return result;
  }
}

const usage = `
Usage:
    npm run node-custom-llm-stream "Hello, world"
Description:
    This example demonstrates how to create a custom node that streams a LLM response.
    The node is asynchronous and will return the LLM response.
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  const llmNode = new RemoteLLMChatNode({
    id: 'llm-node',
    provider,
    modelName,
    stream: true,
  });

  const customNode = new CustomStreamReaderNode();

  const graph = new GraphBuilder({
    id: 'custom_llm_stream_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .addNode(customNode)
    .addEdge(llmNode, customNode)
    .setStartNode(llmNode)
    .setEndNode(customNode)
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
  const result = await outputStream.next();
  result.processResponse({
    string: (data) => {
      console.log(`LLM stream result: ${data}`);
    },
    default: (data) => {
      console.log('Unprocessed data:', data);
    },
    error: (error) => {
      console.log('error data:', error);
    },
  });
  stopInworldRuntime();
}
