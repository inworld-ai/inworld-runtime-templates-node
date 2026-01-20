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

class CustomDatastoreWriterNode extends CustomNode {
  async process(
    context: ProcessContext,
    input: { userId: string; chatRequest: GraphTypes.LLMChatRequest },
  ): Promise<GraphTypes.LLMChatRequest> {
    console.log(input);
    const { userId, chatRequest } = input;
    const datastore = context.getDatastore();
    datastore.add('userId', userId);
    return new GraphTypes.LLMChatRequest(chatRequest);
  }
}

class CustomStreamReaderNode extends CustomNode {
  async process(
    context: ProcessContext,
    contentStream: GraphTypes.ContentStream,
  ): Promise<string> {
    const datastore = context.getDatastore();
    console.log('datastore', datastore);
    let result = '';
    console.log(
      `
      Text stream for user: ${datastore.get('userId')} (derived from CustomDatastoreWriterNode)
      Living at ${datastore.get('address')} (the address derived from initial datastore data):
      
      `,
    );
    for await (const chunk of contentStream) {
      if (chunk.content) result += chunk.content;
    }
    return result;
  }
}

const usage = `
Usage:
    npm run node-custom-llm-stream-with-datastore "Hello, world"
Description:
    This example demonstrates how to create a custom node that streams a LLM response.
    The node is asynchronous and will return the LLM response.
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs(usage);

  const datastoreWriterNode = new CustomDatastoreWriterNode();
  const llmNode = new RemoteLLMChatNode({
    id: 'llm-node',
    provider,
    modelName,
    stream: true,
  });

  const customStreamReaderWithDatastoreNode = new CustomStreamReaderNode();

  const graph = new GraphBuilder({
    id: 'custom_llm_stream_with_datastore_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(datastoreWriterNode)
    .addNode(llmNode)
    .addNode(customStreamReaderWithDatastoreNode)
    .addEdge(datastoreWriterNode, llmNode)
    .addEdge(llmNode, customStreamReaderWithDatastoreNode)
    .setStartNode(datastoreWriterNode)
    .setEndNode(customStreamReaderWithDatastoreNode)
    .build();

  const { outputStream } = await graph.start(
    {
      userId: 'Sherlock Holmes',
      chatRequest: new GraphTypes.LLMChatRequest({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    },
    {
      // this is a datastore content that will be available for all nodes in the graph during the execution
      dataStoreContent: {
        address: 'Baker Street, 221B, London, UK',
      },
    },
  );
  const result = await outputStream.next();
  result.processResponse({
    string: (data) => {
      console.log(`LLM stream result: ${data}`);
    },
    default: (data) => {
      console.log('Unprocessed data:', data);
    },
  });
  stopInworldRuntime();
}
