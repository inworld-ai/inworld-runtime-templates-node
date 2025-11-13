import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
  RemoteLLMComponent,
} from '@inworld/runtime/graph';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
} from '../../shared/constants';
import { parseArgs } from '../../shared/helpers/cli_helpers';

const usage = `
Usage:
    yarn node-llm-chat-explicit-component "Hello, how are you?" \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true/false>[optional, default=true]`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey, stream } = parseArgs(usage);

  const llmComponent = new RemoteLLMComponent({
    provider,
    modelName,
  });

  const llmNode = new RemoteLLMChatNode({
    llmComponent,
    stream,
    textGenerationConfig: {
      maxNewTokens: 500,
    },
  });

  const graph = new GraphBuilder({
    id: 'node_llm_chat_explicit_component_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .setStartNode(llmNode)
    .setEndNode(llmNode)
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
        let resultCount = 0;
        for await (const content of stream) {
          resultText += content.text;
          resultCount++;
        }
        console.log(`Template: Result count: ${resultCount}`);
        console.log(`Template: Result: ${resultText}`);
      },
      Content: (data: GraphTypes.Content) => {
        console.log(`Template: Result: ${data.content}`);
      },
      default: (data: any) => {
        console.error('Unprocessed response:', data);
      },
      error: (error) => {
        console.error('Graph Error:', error);
      },
    });
  }
  stopInworldRuntime();
}
