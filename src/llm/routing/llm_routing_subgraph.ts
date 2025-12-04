import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  FakeRemoteLLMComponent,
  GraphBuilder,
  GraphTypes,
  ProxyNode,
  RemoteLLMComponent,
  SubgraphBuilder,
  SubgraphNode,
} from '@inworld/runtime/graph';

// Import custom nodes
import { LLMExecutorCustomNode } from './llm_executor_custom_node';
import { LLMRouterCustomNode } from './llm_router_custom_node';

const minimist = require('minimist');

interface LLMStrategy {
  id: string;
  priority: number;
  provider: string;
  modelName: string;
  errorCooldownPeriod?: number;
  minErrorsToDisable?: number;
}

const usage = `
Usage:
    yarn llm-routing-subgraph "Tell me a joke" [--simulateFailure]

Examples:
    # Normal operation with fallback
    yarn llm-routing-subgraph "Tell me a short joke"

    # Simulate failure to test fallback mechanism
    yarn llm-routing-subgraph "Tell me a short joke" --simulateFailure
`;

run();

async function run() {
  const { prompt, simulateFailure, apiKey } = parseArgs();

  console.log(`\nPrompt: "${prompt}"`);
  if (simulateFailure) {
    console.log('Simulating failure with fake LLM for testing\n');
  }

  // Define LLM strategies with priorities
  const strategies: LLMStrategy[] = [];

  if (simulateFailure) {
    strategies.push({
      id: 'fake_llm',
      priority: 400,
      provider: 'fake',
      modelName: 'test',
      errorCooldownPeriod: 5.0, // 5 second cooldown after error
      minErrorsToDisable: 1, // Disable after 1 error (for testing)
    });
  }

  strategies.push(
    {
      id: 'claude_llm',
      priority: 300,
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet-20241022',
      errorCooldownPeriod: 5.0, // 5 second cooldown after error
      minErrorsToDisable: 3, // Disable after 3 consecutive errors
    },
    {
      id: 'gpt_llm',
      priority: 350,
      provider: 'openai',
      modelName: 'gpt-4o',
      errorCooldownPeriod: 5.0, // 5 second cooldown after error
      minErrorsToDisable: 3, // Disable after 3 consecutive errors
    },
  );

  // Create LLM components
  const components: Array<RemoteLLMComponent | FakeRemoteLLMComponent> = [];

  if (simulateFailure) {
    components.push(
      new FakeRemoteLLMComponent({
        id: 'fake_llm',
        provider: 'fake',
        modelName: 'test',
        loadTestConfig: {
          errorProbability: 1.0, // Always fail
        },
      }),
    );
  }

  components.push(
    new RemoteLLMComponent({
      id: 'claude_llm',
      provider: 'anthropic',
      modelName: 'claude-3-5-sonnet-20241022',
      defaultConfig: {
        maxNewTokens: 500,
      },
    }),
    new RemoteLLMComponent({
      id: 'gpt_llm',
      provider: 'openai',
      modelName: 'gpt-4o',
    }),
  );

  // Create subgraph nodes
  const inputNode = new ProxyNode({ id: 'input_node' });
  const routerNode = new LLMRouterCustomNode(strategies);
  const executorNode = new LLMExecutorCustomNode(strategies);

  // Build LLM routing subgraph
  const llmRoutingSubgraph = new SubgraphBuilder('llm_routing_subgraph')
    .addNode(inputNode)
    .addNode(routerNode)
    .addNode(executorNode)
    .addEdge(inputNode, routerNode)
    .addEdge(routerNode, executorNode)
    // Loop back on failure to try next strategy
    .addEdge(executorNode, routerNode, {
      conditionExpression:
        '!input.success && input.currentStrategyIndex < ' +
        (strategies.length - 1),
      optional: true,
      loop: true,
    })
    .setStartNode(inputNode)
    .setEndNode(executorNode);

  // Create subgraph node
  const llmRoutingSubgraphNode = new SubgraphNode({
    subgraphId: 'llm_routing_subgraph',
  });

  // Build main graph with LLM routing subgraph
  const graphBuilder = new GraphBuilder({
    id: 'llm_routing_main',
    enableRemoteConfig: false,
    apiKey,
  });

  // Add components
  for (const component of components) {
    graphBuilder.addComponent(component);
  }

  const graph = graphBuilder
    .addSubgraph(llmRoutingSubgraph)
    .addNode(llmRoutingSubgraphNode)
    .setStartNode(llmRoutingSubgraphNode)
    .setEndNode(llmRoutingSubgraphNode)
    .build();

  try {
    const { outputStream } = await graph.start(
      new GraphTypes.LLMChatRequest({
        messages: [
          {
            role: 'user',
            content: prompt,
            toolCallId: '',
          },
        ],
      }),
    );

    for await (const result of outputStream) {
      await result.processResponse({
        default: (data: any) => {
          // Only show final result (skip intermediate failures that will retry)
          if (data.success) {
            // Success case - show result
            console.log('\n=== LLM Routing Result ===');
            const sortedStrategies = strategies.sort(
              (a, b) => b.priority - a.priority,
            );
            const usedStrategy = sortedStrategies[data.currentStrategyIndex];
            console.log(
              `Strategy Used: ${usedStrategy.provider}/${usedStrategy.modelName}`,
            );
            console.log(`Attempts: ${data.attemptCount}`);
            if (data.failedStrategies.length > 0) {
              console.log(
                `Failed Strategies: ${data.failedStrategies.join(', ')}`,
              );
              if (data.partialResponse) {
                console.log(
                  `Note: Response includes partial content from failed LLM(s)`,
                );
              }
            }
          } else if (data.currentStrategyIndex >= strategies.length - 1) {
            // Failure case - only show if we've exhausted all strategies
            console.log('\n=== LLM Routing Result ===');
            console.log(`FAILURE: All strategies exhausted`);
            console.log(`Total Attempts: ${data.attemptCount}`);
            console.log(
              `Failed Strategies: ${data.failedStrategies.join(', ')}`,
            );
          }
          // Skip intermediate failures (they will retry)
        },
        error: (error: GraphTypes.GraphError) => {
          console.error(`\nGraph execution error: ${error.message}\n`);
        },
      });
    }
  } catch (error: any) {
    console.error('\nLLM routing failed:', error.message);
  }

  stopInworldRuntime();
}

function parseArgs(): {
  prompt: string;
  simulateFailure: boolean;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const prompt = argv._?.join(' ') || '';
  const simulateFailure =
    argv.simulateFailure === 'true' || argv.simulateFailure === true;
  const apiKey = process.env.INWORLD_API_KEY || '';

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
    simulateFailure,
    apiKey,
  };
}
