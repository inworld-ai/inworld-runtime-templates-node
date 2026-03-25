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
import { Message, ResponseFormat } from '@inworld/runtime/primitives/llm';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
  TOOLS,
} from '../shared/constants';
import { parseArgs } from '../shared/helpers/cli_helpers';

const usage = `
Usage:
    npm run node-llm-interface-overloads "Hello, how are you?" -- \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true/false>[optional, default=true]

Demonstrates all three LLMInterface.generateContent overloads:
  1. String prompt input
  2. LLMChatRequest input
  3. Message[] with tools input`;

/**
 * Custom node that exercises all three generateContent overloads
 * available on the LLMInterface obtained from the component registry.
 */
class LLMInterfaceOverloadsNode extends CustomNode {
  async process(
    context: ProcessContext,
    contentStream: GraphTypes.ContentStream,
  ): Promise<{
    stringOverload: string;
    chatRequestOverload: string;
    messagesOverload: string;
  }> {
    let initialResult = '';
    for await (const chunk of contentStream) {
      if (chunk.content) initialResult += chunk.content;
    }

    const llm = context.getLLMInterface('llm-component');

    // --- Overload 1: string input ---
    const stream1 = await llm.generateContent(
      `Respond with exactly one word: ${initialResult}`,
      ResponseFormat.Text,
    );
    let stringOverload = '';
    for await (const chunk of stream1) {
      if (chunk.content) stringOverload += chunk.content;
    }
    console.log(`[Overload 1] String overload result: ${stringOverload}`);

    // --- Overload 2: LLMChatRequest input ---
    const stream2 = await llm.generateContent(
      new GraphTypes.LLMChatRequest({
        messages: [
          {
            role: 'user',
            content: `Summarize in one sentence: ${initialResult}`,
          },
        ],
      }),
      ResponseFormat.Text,
    );
    let chatRequestOverload = '';
    for await (const chunk of stream2) {
      if (chunk.content) chatRequestOverload += chunk.content;
    }
    console.log(
      `[Overload 2] LLMChatRequest overload result: ${chatRequestOverload}`,
    );

    // --- Overload 3: Message[] with tools input ---
    const messages: Message[] = [
      {
        role: 'user',
        content: 'What is the weather in San Francisco?',
        toolCallId: '',
      },
    ];
    const stream3 = await llm.generateContent(
      messages,
      ResponseFormat.Text,
      TOOLS,
    );
    let messagesOverload = '';
    const toolCalls: any[] = [];
    for await (const chunk of stream3) {
      if (chunk.content) messagesOverload += chunk.content;
      if (chunk.toolCalls?.length) toolCalls.push(...chunk.toolCalls);
    }
    const toolCallsSummary = toolCalls
      .map((tc) => `${tc.name}(${tc.arguments ?? tc.args ?? ''})`)
      .join(', ');
    console.log(
      `[Overload 3] Messages overload result: ${messagesOverload || toolCallsSummary || '(empty)'}`,
    );

    return { stringOverload, chatRequestOverload, messagesOverload };
  }
}

run();

async function run() {
  const { prompt, modelName, provider, apiKey, stream } = parseArgs(usage);

  const llmComponent = new RemoteLLMComponent({
    id: 'llm-component',
    modelId: `${provider}/${modelName}`,
  });

  const llmNode = new RemoteLLMChatNode({
    llmComponent,
    stream,
    textGenerationConfig: {
      maxNewTokens: 500,
    },
  });
  const overloadsNode = new LLMInterfaceOverloadsNode();

  const graph = new GraphBuilder({
    id: 'llm_interface_overloads_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(llmNode)
    .addNode(overloadsNode)
    .addEdge(llmNode, overloadsNode)
    .setStartNode(llmNode)
    .setEndNode(overloadsNode)
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
      ContentStream: async (s: GraphTypes.ContentStream) => {
        let resultText = '';
        let resultCount = 0;
        for await (const content of s) {
          resultText += content.content;
          resultCount++;
        }
        console.log(`Template: Result count: ${resultCount}`);
        console.log(`Template: Result: ${resultText}`);
      },
      Content: (data: GraphTypes.Content) => {
        console.log(`Template: Result: ${data.content}`);
      },
      default: (data: any) => {
        console.log('Template: All overloads completed.');
        if (data.stringOverload) {
          console.log(
            `Template: String overload length: ${data.stringOverload.length}`,
          );
        }
        if (data.chatRequestOverload) {
          console.log(
            `Template: ChatRequest overload length: ${data.chatRequestOverload.length}`,
          );
        }
        if (data.messagesOverload !== undefined) {
          console.log(
            `Template: Messages overload length: ${data.messagesOverload.length}`,
          );
        }
      },
      error: (error) => {
        console.error('Graph Error:', error);
      },
    });
  }
  stopInworldRuntime();
}
