import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';
import { z } from 'zod';

import { parseArgs } from '../shared/helpers/cli_helpers';

/**
 * Define a Zod schema for dataStore validation.
 * This provides runtime validation when setting values via context.dataStore.
 *
 * After rebuilding the runtime package, you can also get TypeScript type inference
 * by using the 4th generic parameter on CustomNode:
 *
 * @example
 * ```typescript
 * type MyDataStore = z.infer<typeof DataStoreSchema>;
 *
 * class MyNode extends CustomNode<InputType, OutputType, {}, MyDataStore> {
 *   schema = { dataStore: DataStoreSchema };
 *
 *   async process(context: ProcessContext<MyDataStore>, input: InputType) {
 *     context.dataStore.userId = 'user123'; // TypeScript knows this is string
 *   }
 * }
 * ```
 */
const DataStoreSchema = z.object({
  userId: z.string(),
  address: z.string(),
});

/**
 * Custom node that writes to the dataStore with schema validation.
 * Setting an invalid value (e.g., userId = 123) will throw a validation error.
 */
class CustomDatastoreWriterNode extends CustomNode {
  schema = { dataStore: DataStoreSchema };

  async process(
    context: ProcessContext<z.infer<typeof DataStoreSchema>>,
    input: { userId: string; chatRequest: GraphTypes.LLMChatRequest },
  ): Promise<GraphTypes.LLMChatRequest> {
    const { userId, chatRequest } = input;
    context.dataStore.userId = userId;
    return new GraphTypes.LLMChatRequest(chatRequest);
  }
}

/**
 * Custom node that reads from the dataStore.
 */
class CustomStreamReaderNode extends CustomNode {
  schema = { dataStore: DataStoreSchema };

  async process(
    context: ProcessContext,
    contentStream: GraphTypes.ContentStream,
  ): Promise<string> {
    console.log('datastore userId:', context.dataStore.userId);
    let result = '';
    console.log(
      `
      Text stream for user: ${context.dataStore.userId} (derived from CustomDatastoreWriterNode)
      Living at ${context.dataStore.address} (the address derived from initial datastore data):
      
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
