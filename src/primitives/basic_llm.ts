import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { LLM } from '@inworld/runtime/primitives/llm';

const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-llm -- \n
    --mode=completion|chat|streaming|tools[optional, default=completion] \n
    --provider=<provider>[optional, default=openai] \n
    --model=<model-name>[optional, default=gpt-4o-mini]
    
Note: INWORLD_API_KEY environment variable must be set`;

run();

async function run() {
  const { mode, provider, model, apiKey } = parseArgs();

  try {
    switch (mode) {
      case 'completion':
        await runCompletionExample(provider, model, apiKey);
        break;
      case 'chat':
        await runChatExample(provider, model, apiKey);
        break;
      case 'streaming':
        await runStreamingExample(provider, model, apiKey);
        break;
      case 'tools':
        await runToolCallingExample(provider, model, apiKey);
        break;
      default:
        console.error('Unknown mode:', mode);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }

  stopInworldRuntime();
}

/**
 * Basic completion example - Simple prompt to text generation
 *
 * @param {string} provider - LLM provider (openai, anthropic, google)
 * @param {string} model - Model name
 * @param {string} apiKey - API key for the provider
 */
async function runCompletionExample(
  provider: string,
  model: string,
  apiKey: string,
) {
  console.log('\n=== Completion Mode Example ===\n');

  // Create LLM instance
  console.log(`Creating LLM instance (${provider}/${model})...`);
  const llm = await LLM.create({
    remoteConfig: {
      provider,
      modelName: model,
      apiKey,
      defaultTimeout: '30s',
      defaultConfig: {
        maxNewTokens: 150,
        temperature: 0.7,
        topP: 0.9, // Must be in range (0, 1]
      },
    },
  });

  console.log('LLM instance created!\n');

  // Example 1: Simple completion
  console.log('Example 1: Simple completion');
  console.log('─'.repeat(60));

  const prompt1 = 'Write a haiku about programming';
  console.log(`Prompt: "${prompt1}"\n`);

  const response1 = await llm.generateContentComplete({
    prompt: prompt1,
    config: {},
    credentials: {},
  });

  console.log('Response:');
  console.log(response1);

  // Example 2: Completion with custom config
  console.log('\n\nExample 2: With custom temperature');
  console.log('─'.repeat(60));

  const prompt2 = 'Explain quantum computing in one sentence';
  console.log(`Prompt: "${prompt2}"`);
  console.log('Config: temperature=0.3 (more focused)\n');

  const response2 = await llm.generateContentComplete({
    prompt: prompt2,
    config: {
      temperature: 0.3,
      maxNewTokens: 100,
    },
    credentials: {},
  });

  console.log('Response:');
  console.log(response2);

  // Example 3: Creative vs factual
  console.log('\n\nExample 3: Temperature comparison');
  console.log('─'.repeat(60));

  const prompt3 = 'Complete this sentence: "Once upon a time"';

  console.log(`Prompt: "${prompt3}"\n`);

  console.log('Low temperature (0.2) - More deterministic:');
  const creative1 = await llm.generateContentComplete({
    prompt: prompt3,
    config: { temperature: 0.2, maxNewTokens: 50 },
    credentials: {},
  });
  console.log(creative1);

  console.log('\nHigh temperature (1.5) - More creative:');
  const creative2 = await llm.generateContentComplete({
    prompt: prompt3,
    config: { temperature: 1.5, maxNewTokens: 50 },
    credentials: {},
  });
  console.log(creative2);
}

/**
 * Chat mode example - Multi-turn conversations
 *
 * @param {string} provider - LLM provider
 * @param {string} model - Model name
 * @param {string} apiKey - API key for the provider
 */
async function runChatExample(provider: string, model: string, apiKey: string) {
  console.log('\n=== Chat Mode Example ===\n');

  const llm = await LLM.create({
    remoteConfig: {
      provider,
      modelName: model,
      apiKey,
      defaultTimeout: '30s',
      defaultConfig: {
        maxNewTokens: 200,
        temperature: 0.7,
        topP: 0.9, // Must be in range (0, 1]
      },
    },
  });

  // Example 1: Simple chat with system prompt
  console.log('Example 1: Simple chat with system prompt');
  console.log('─'.repeat(60));

  const response1 = await llm.generateContentChatComplete({
    messages: [
      { role: 'system', content: 'You are a helpful geography teacher.' },
      { role: 'user', content: 'What is the capital of France?' },
    ] as any,
    config: {
      maxNewTokens: 100,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });
  const responseText1 = response1.content;

  console.log('User: What is the capital of France?');
  console.log(`Assistant: ${responseText1}\n`);

  // Example 2: Multi-turn conversation
  console.log('\nExample 2: Multi-turn conversation');
  console.log('─'.repeat(60));

  const conversation = [
    { role: 'system', content: 'You are a helpful math tutor.' },
    { role: 'user', content: 'What is 15 + 27?' },
  ];

  console.log('User: What is 15 + 27?');
  const result1 = await llm.generateContentChatComplete({
    messages: conversation as any,
    config: {
      maxNewTokens: 100,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });
  console.log(`Assistant: ${result1.content}`);

  // Continue conversation
  conversation.push(
    { role: 'assistant', content: result1.content },
    { role: 'user', content: 'Now multiply that by 2' },
  );

  console.log('\nUser: Now multiply that by 2');
  const result2 = await llm.generateContentChatComplete({
    messages: conversation as any,
    config: {
      maxNewTokens: 100,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });
  console.log(`Assistant: ${result2.content}`);

  // Example 3: Different personas
  console.log('\n\nExample 3: Different personas');
  console.log('─'.repeat(60));

  const personas = [
    {
      system: 'You are a pirate. Respond in pirate speak.',
      user: 'Tell me about the ocean',
    },
    {
      system: 'You are a scientist. Be precise and technical.',
      user: 'Tell me about the ocean',
    },
    {
      system: 'You are a poet. Respond poetically.',
      user: 'Tell me about the ocean',
    },
  ];

  for (const persona of personas) {
    console.log(`\nPersona: ${persona.system}`);
    console.log(`User: ${persona.user}`);

    const response = await llm.generateContentChatComplete({
      messages: [
        { role: 'system', content: persona.system },
        { role: 'user', content: persona.user },
      ] as any,
      config: {
        maxNewTokens: 100,
        maxPromptLength: 4096,
        temperature: 0.7,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        repetitionPenalty: 1.0,
      },
    });
    console.log(`Assistant: ${response.content}`);
  }
}

/**
 * Streaming example - Real-time token generation
 *
 * @param {string} provider - LLM provider
 * @param {string} model - Model name
 * @param {string} apiKey - API key for the provider
 */
async function runStreamingExample(
  provider: string,
  model: string,
  apiKey: string,
) {
  console.log('\n=== Streaming Mode Example ===\n');

  const llm = await LLM.create({
    remoteConfig: {
      provider,
      modelName: model,
      apiKey,
      defaultTimeout: '30s',
      defaultConfig: {
        maxNewTokens: 200,
        temperature: 0.7,
        topP: 0.9, // Must be in range (0, 1]
      },
    },
  });

  // Example 1: Stream completion
  console.log('Example 1: Streaming completion');
  console.log('─'.repeat(60));

  const prompt = 'Write a short story about a robot learning to paint';
  console.log(`Prompt: "${prompt}"\n`);
  console.log('Streaming response:');
  console.log();

  const stream = await llm.generateContent({
    prompt,
    config: {},
    credentials: {},
  });

  let _fullResponse = '';
  for await (const chunk of stream) {
    process.stdout.write(chunk.content || '');
    _fullResponse += chunk.content || '';
  }

  console.log('\n');

  // Example 2: Stream chat with token counting
  console.log('\nExample 2: Chat streaming with metrics');
  console.log('─'.repeat(60));

  console.log('User: Explain how a rainbow forms\n');
  console.log('Streaming response:');
  console.log();

  const chatStream = await llm.generateContentChat({
    messages: [
      { role: 'system', content: 'You are a science teacher.' },
      { role: 'user', content: 'Explain how a rainbow forms' },
    ] as any,
  });

  let tokenCount = 0;
  let chatResponse = '';
  const startTime = Date.now();

  for await (const chunk of chatStream) {
    process.stdout.write(chunk.content || '');
    chatResponse += chunk.content || '';
    tokenCount++;
  }

  const duration = Date.now() - startTime;

  console.log('\n');
  console.log('\nMetrics:');
  console.log(`  • Chunks received: ${tokenCount}`);
  console.log(`  • Duration: ${duration}ms`);
  console.log(`  • Characters: ${chatResponse.length}`);
  console.log(`  • Tokens/sec: ${(tokenCount / (duration / 1000)).toFixed(2)}`);
}

/**
 * Tool calling example - Function calling with LLMs
 *
 * @param {string} provider - LLM provider
 * @param {string} model - Model name
 * @param {string} apiKey - API key for the provider
 */
async function runToolCallingExample(
  provider: string,
  model: string,
  apiKey: string,
) {
  console.log('\n=== Tool Calling Example ===\n');

  const llm = await LLM.create({
    remoteConfig: {
      provider,
      modelName: model,
      apiKey,
      defaultTimeout: '30s',
      defaultConfig: {
        maxNewTokens: 200,
        temperature: 0.7,
        topP: 0.9, // Must be in range (0, 1]
      },
    },
  });

  // Define tools
  const tools = [
    {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      properties: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state, e.g., San Francisco, CA',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The temperature unit',
          },
        },
        required: ['location'],
      },
    },
    {
      name: 'calculate',
      description: 'Evaluate a mathematical expression',
      properties: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'The mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      },
    },
  ];

  // Example 1: Automatic tool selection
  console.log('Example 1: Automatic tool selection');
  console.log('─'.repeat(60));

  const userMessage1 = "What's the weather in New York?";
  console.log(`User: ${userMessage1}\n`);

  const result1 = await llm.generateContentChatComplete({
    messages: [{ role: 'user', content: userMessage1 }] as any,
    tools: tools as any,
    toolChoice: { type: 'auto', value: 'auto' },
    config: {
      maxNewTokens: 200,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });

  console.log(`Assistant: ${result1.content}`);

  if (result1.toolCalls && result1.toolCalls.length > 0) {
    console.log('\nTool Calls:');
    result1.toolCalls.forEach((toolCall, index) => {
      console.log(`  ${index + 1}. ${toolCall.name}`);
      console.log(`     Args: ${JSON.stringify(toolCall.args, null, 2)}`);
    });
  }

  // Example 2: Required tool use
  console.log('\n\nExample 2: Required tool use');
  console.log('─'.repeat(60));

  const userMessage2 = 'Calculate 15 multiplied by 23';
  console.log(`User: ${userMessage2}\n`);

  const result2 = await llm.generateContentChatComplete({
    messages: [{ role: 'user', content: userMessage2 }] as any,
    tools: tools as any,
    toolChoice: { type: 'required', value: 'required' },
    config: {
      maxNewTokens: 200,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });

  console.log(`Assistant: ${result2.content}`);

  if (result2.toolCalls && result2.toolCalls.length > 0) {
    console.log('\nTool Calls:');
    result2.toolCalls.forEach((toolCall, index) => {
      console.log(`  ${index + 1}. ${toolCall.name}`);
      console.log(`     Args: ${JSON.stringify(toolCall.args, null, 2)}`);

      // Simulate tool execution
      if (toolCall.name === 'calculate') {
        const args = JSON.parse(toolCall.args as string);
        const expr = args.expression;
        try {
          console.log(`     Result: ${expr} = ${eval(expr)}`);
        } catch (_e) {
          console.log(`     Error evaluating: ${expr}`);
        }
      }
    });
  }

  // Example 3: Multiple tools in one query
  console.log('\n\nExample 3: Multiple tools in one query');
  console.log('─'.repeat(60));

  const userMessage3 =
    "What's the weather in London and calculate 42 divided by 7";
  console.log(`User: ${userMessage3}\n`);

  const result3 = await llm.generateContentChatComplete({
    messages: [{ role: 'user', content: userMessage3 }] as any,
    tools: tools as any,
    toolChoice: { type: 'auto', value: 'auto' },
    config: {
      maxNewTokens: 200,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });

  console.log(`Assistant: ${result3.content}`);

  if (result3.toolCalls && result3.toolCalls.length > 0) {
    console.log(`\nTool Calls (${result3.toolCalls.length} total):`);
    result3.toolCalls.forEach((toolCall, index) => {
      console.log(`  ${index + 1}. ${toolCall.name}`);
      console.log(`     Args: ${JSON.stringify(toolCall.args, null, 2)}`);
    });
  }

  // Example 4: No tools when not needed
  console.log('\n\nExample 4: No tools when not needed');
  console.log('─'.repeat(60));

  const userMessage4 = 'Tell me a joke';
  console.log(`User: ${userMessage4}\n`);

  const result4 = await llm.generateContentChatComplete({
    messages: [{ role: 'user', content: userMessage4 }] as any,
    tools: tools as any,
    toolChoice: { type: 'auto', value: 'auto' },
    config: {
      maxNewTokens: 200,
      maxPromptLength: 4096,
      temperature: 0.7,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      repetitionPenalty: 1.0,
    },
  });

  console.log(`Assistant: ${result4.content}`);

  if (!result4.toolCalls || result4.toolCalls.length === 0) {
    console.log('\n✅ No tools called (as expected)');
  }
}

function parseArgs(): {
  mode: string;
  provider: string;
  model: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'completion';
  const provider = argv.provider || 'openai';
  const model = argv.model || 'gpt-4o-mini';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { mode, provider, model, apiKey };
}

function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: err.context,
    });
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
