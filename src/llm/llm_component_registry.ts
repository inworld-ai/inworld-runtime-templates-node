import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
  RemoteLLMComponent,
} from '@inworld/runtime/graph';
import { ResponseFormat } from '@inworld/runtime/primitives/llm';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
} from '../shared/constants';
import { parseArgs } from '../shared/helpers/cli_helpers';

const usage = `
Usage:
    npm run node-llm-chat-component-registry "Hello, how are you?" -- \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true/false>[optional, default=true]`;

class CustomStreamReaderNode extends CustomNode {
  async process(
    context: ProcessContext,
    contentStream: GraphTypes.ContentStream,
  ): Promise<{
    llmResult: string;
    llmEnhancedResult: string;
  }> {
    let result = '';
    for await (const chunk of contentStream) {
      if (chunk.content) result += chunk.content;
    }
    const llm = context.getLLMInterface('llm-component');
    const contentStream1 = await llm.generateContent(
      new GraphTypes.LLMChatRequest({
        messages: [
          {
            role: 'user',
            content: `Transform the LLM response as it is from Gendalf: ${result}`,
          },
        ],
      }),
      ResponseFormat.Text,
    );
    let result2 = '';
    for await (const chunk of contentStream1) {
      if (chunk.content) result2 += chunk.content;
    }
    return {
      llmResult: result,
      llmEnhancedResult: result2,
    };
  }
}
run();

async function run() {
  const { prompt, modelName, provider, apiKey, stream } = parseArgs(usage);

  const llmComponent = new RemoteLLMComponent({
    id: 'llm-component',
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
  const customStreamReaderNode = new CustomStreamReaderNode();

  const graph = new GraphBuilder({
    id: 'node_llm_chat_component_registry_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .addNode(customStreamReaderNode)
    .addEdge(llmNode, customStreamReaderNode)
    .setStartNode(llmNode)
    .setEndNode(customStreamReaderNode)
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
          resultText += content.content;
          resultCount++;
        }
        console.log(`Template: Result count: ${resultCount}`);
        console.log(`Template: Result: ${resultText}`);
      },
      Content: (data: GraphTypes.Content) => {
        console.log(`Template: Result: ${data.content}`);
      },
      default: (data: { llmResult: string; llmEnhancedResult: string }) => {
        console.error('Unprocessed response:', data);
      },
      error: (error) => {
        console.error('Graph Error:', error);
      },
    });
  }
  stopInworldRuntime();
}
