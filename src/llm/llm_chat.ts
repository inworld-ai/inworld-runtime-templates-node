import 'dotenv/config';

import {
  LLMChatRequestInterface,
  LLMMessageInterface,
  stopInworldRuntime,
} from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
} from '@inworld/runtime/graph';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
  TOOLS,
} from '../shared/constants';

const minimist = require('minimist');

const usage = `
Usage:
    yarn node-llm-chat "Tell me the weather in Vancouver and evaluate the expression 2 + 2" \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=${DEFAULT_LLM_PROVIDER}] \n
    --stream=<true|false>[optional, default=true, enable/disable streaming] \n
    --tools[optional, enable tool calling demonstration] \n
    --toolChoice=<auto|required|none|function_name>[optional, tool choice strategy when --tools is used] \n
    --imageUrl=<image-url>[optional, include an image in the message for multimodal input]
    --responseFormat=<text|json>[optional, response format for the LLM]
    --toolCallHistory=<true|false>[optional, enable/disable tool call history]
    --useTemplates[optional, use message templates to build chat requests from JSON input]

Examples:
    # Basic request
    yarn node-llm-chat "Tell me the weather in Vancouver"

    # Basic request with tools
    yarn node-llm-chat "What is 15 + 27?" --modelName="gpt-4o-mini" --provider="openai" --tools --toolChoice="auto"
    
    # Specific tool choice.
    yarn node-llm-chat "What is the weather in Vancouver?" --modelName="gpt-4o-mini" --provider="openai" --tools --toolChoice="get_weather"
    
    # Multimodal request with image
    yarn node-llm-chat "What do you see in this image?" --modelName="gpt-4o" --provider="openai" --imageUrl="https://upload.wikimedia.org/wikipedia/en/a/a9/Example.jpg"

    # Request with response format
    yarn node-llm-chat "Generate a user profile for a software engineer. Include name, profession, experience_years, skills array, and location. return in json format" --modelName="gpt-4o-mini" --provider="openai" --responseFormat="json"

    # Using message templates with JSON input (transforms JSON into chat messages)
    # Note: Message templates REQUIRE JSON input and are FORBIDDEN with text input
    yarn node-llm-chat '{"user_name": "Alice", "question": "What is the capital of France?"}' --modelName="gpt-4o-mini" --provider="openai" --useTemplates
    
    # More complex JSON with templates
    yarn node-llm-chat '{"user_name": "Bob", "question": "Explain quantum computing"}' --modelName="gpt-4o" --provider="openai" --useTemplates --stream=false
    
    # Templates are ignored when using LLMChatRequest input (full message object)
    # Templates work only with plain JSON input, converting it to messages via template interpolation
    `;

run();

async function run() {
  const {
    prompt,
    modelName,
    provider,
    apiKey,
    tools,
    stream,
    toolChoice,
    imageUrl,
    responseFormat,
    toolCallHistory,
    useTemplates,
  } = parseArgs();

  // Message templates allow using Jinja2 templating in message content.
  // The text field can contain {{variable_name}} placeholders that will be
  // replaced with values from the JSON input.
  const messageTemplates = useTemplates
    ? [
        {
          role: 'system' as const,
          content:
            "You are a helpful assistant. Answer questions clearly and concisely. The answer should include a call to the user's name.",
        },
        {
          role: 'user' as const,
          // Jinja templates go in the text field of TextContentItem
          content: [
            {
              type: 'text' as const,
              text: 'User {{user_name}} asks: {{question}}',
            },
          ],
        },
      ]
    : undefined;

  // Validate input type compatibility with message templates
  if (useTemplates) {
    try {
      JSON.parse(prompt);
      console.log(
        '✓ Using message templates with JSON input (templates will transform JSON to messages)',
      );
    } catch (_) {
      throw new Error(
        'Message templates require JSON input. Text input is forbidden when using templates.\n' +
          'Example: yarn node-llm-chat \'{"user_name": "Alice", "question": "What is the capital?"}\' --useTemplates',
      );
    }
  }

  const llmNode = new RemoteLLMChatNode({
    stream,
    provider,
    modelName,
    textGenerationConfig: {
      maxNewTokens: 200,
    },
    messageTemplates,
  });

  const graph = new GraphBuilder({
    id: 'node_llm_chat_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(llmNode)
    .setStartNode(llmNode)
    .setEndNode(llmNode)
    .build();

  let graphInput;

  // When using templates, pass JSON input directly (templates will transform it)
  if (useTemplates) {
    console.log('📋 Input JSON:', prompt);
    graphInput = JSON.parse(prompt);
  } else {
    // Standard flow: build LLMChatRequest from messages
    if (tools) {
      graphInput = createMessagesWithTools(
        prompt,
        toolChoice,
        imageUrl,
        toolCallHistory,
      );
    } else {
      graphInput = createMessages(prompt, imageUrl, toolCallHistory);
    }

    if (responseFormat) {
      graphInput.responseFormat = responseFormat;
    }
    graphInput = new GraphTypes.LLMChatRequest(graphInput);
  }

  const { outputStream } = await graph.start(graphInput);

  for await (const result of outputStream) {
    await result.processResponse({
      Content: (response: GraphTypes.Content) => {
        console.log('📥 LLM Chat Response:');
        console.log('  Content:', response.content);
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log('  Tool Calls:');
          response.toolCalls.forEach((toolCall, index) => {
            console.log(`    ${index + 1}. ${toolCall.name}(${toolCall.args})`);
            console.log(`       ID: ${toolCall.id}`);
          });
        }
      },
      ContentStream: async (stream: GraphTypes.ContentStream) => {
        console.log('📡 LLM Chat Response Stream:');
        let streamContent = '';
        const toolCalls: { [id: string]: any } = {};
        let chunkCount = 0;
        for await (const chunk of stream) {
          chunkCount++;
          if (chunk.text) {
            streamContent += chunk.text;
            process.stdout.write(chunk.text);
          }
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            for (const toolCall of chunk.toolCalls) {
              if (toolCalls[toolCall.id]) {
                toolCalls[toolCall.id].args += toolCall.args;
              } else {
                toolCalls[toolCall.id] = { ...toolCall };
              }
            }
          }
        }
        console.log(`\nTotal chunks: ${chunkCount}`);
        console.log(`Final content length: ${streamContent.length} characters`);
        const finalToolCalls = Object.values(toolCalls);
        if (finalToolCalls.length > 0) {
          console.log('Tool Calls from Stream:');
          finalToolCalls.forEach((toolCall, index) => {
            console.log(`  ${index + 1}. ${toolCall.name}(${toolCall.args})`);
            console.log(`     ID: ${toolCall.id}`);
          });
        }
      },
      default: (data: any) => {
        console.error('Unprocessed response:', data);
      },
      error: (error: GraphTypes.GraphError) => {
        throw new Error(error.message);
      },
    });
  }
  stopInworldRuntime();
}

function createMessages(
  prompt: string,
  imageUrl?: string,
  toolCallHistory?: boolean,
): LLMChatRequestInterface {
  const systemMessage: LLMMessageInterface = {
    role: 'system',
    content:
      'You are a helpful assistant that can use tools when needed. When analyzing images, describe what you see and use appropriate tools if calculations or weather information is needed.',
  };

  const previousUserMessage: LLMMessageInterface = {
    role: 'user',
    content: 'Hi please call the calculator tool to calculate 2 + 2',
  };

  const firstAssistantMessage: LLMMessageInterface = {
    role: 'assistant',
    content: '',
    toolCalls: [
      {
        id: '1',
        name: 'calculator',
        args: '{"a": 2, "b": 2}',
      },
    ],
  };

  const toolMessage: LLMMessageInterface = {
    role: 'tool',
    toolCallId: '1',
    content: '5',
  };

  let userMessage: LLMMessageInterface;
  if (imageUrl) {
    // For multimodal: ONLY set contentItems, NOT content - they are mutually exclusive
    userMessage = {
      role: 'user',
      contentItems: [
        {
          text: prompt,
        },
        {
          image: {
            url: imageUrl,
            detail: 'high',
          },
        },
      ],
    } as LLMMessageInterface;
  } else {
    userMessage = {
      role: 'user',
      content: prompt,
    };
  }

  if (toolCallHistory) {
    return {
      messages: [
        systemMessage,
        previousUserMessage,
        firstAssistantMessage,
        toolMessage,
        userMessage,
      ],
    };
  } else {
    return {
      messages: [systemMessage, userMessage],
    };
  }
}

function createMessagesWithTools(
  userPrompt: string,
  toolChoice?: string,
  imageUrl?: string,
  toolCallHistory?: boolean,
) {
  const messages = createMessages(
    userPrompt,
    imageUrl,
    toolCallHistory,
  ).messages;

  const result: any = {
    messages,
    tools: TOOLS.map(normalizeToolDefinition),
  };

  if (toolChoice) {
    if (
      toolChoice === 'auto' ||
      toolChoice === 'required' ||
      toolChoice === 'none'
    ) {
      result.toolChoice = {
        type: toolChoice,
      };
    } else {
      // Assume it's a specific function name
      result.toolChoice = {
        type: 'function',
        function: {
          type: 'function',
          name: toolChoice,
        },
      };
    }
  }

  return result;
}

function normalizeToolDefinition(tool: any) {
  if (!tool) {
    return tool;
  }
  if (tool.properties !== undefined && typeof tool.properties !== 'string') {
    return {
      ...tool,
      properties: JSON.stringify(tool.properties),
    };
  }
  return tool;
}

function parseArgs(): {
  prompt: string;
  modelName: string;
  provider: string;
  apiKey: string;
  tools: boolean;
  stream: boolean;
  toolChoice?: string;
  imageUrl?: string;
  responseFormat?: string;
  toolCallHistory?: boolean;
  useTemplates?: boolean;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }
  const prompt = argv._?.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || '';
  const tools = !!argv.tools;
  const stream = argv.stream !== undefined ? argv.stream === 'true' : true;
  const toolChoice = argv.toolChoice || undefined;
  const imageUrl = argv.imageUrl || undefined;
  const responseFormat = argv.responseFormat || 'text';
  const toolCallHistory =
    argv.toolCallHistory !== undefined
      ? argv.toolCallHistory === 'true'
      : false;
  const useTemplates = !!argv.useTemplates;

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    prompt,
    modelName,
    provider,
    apiKey,
    tools,
    stream,
    toolChoice,
    imageUrl,
    responseFormat,
    toolCallHistory,
    useTemplates,
  };
}
