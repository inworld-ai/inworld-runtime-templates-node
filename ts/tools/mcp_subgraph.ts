import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { LLMMessageInterface } from '@inworld/runtime';
import {
  GraphBuilder,
  GraphTypes,
  MCPClientComponent,
  RemoteLLMComponent,
  SubgraphNode,
} from '@inworld/runtime/graph';

import { TEXT_CONFIG_SDK } from '../shared/constants';
import { parseArgs } from '../shared/helpers/cli_helpers';

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to external tools. 
When a user asks a question, you should determine if you need to use any available tools to answer their question.
If you need to use tools, make the appropriate tool calls with the correct parameters.
If you don't need tools, respond directly to the user.`;

const usage = `
Usage:
    yarn node-mcp-subgraph "What's the weather like in San Francisco?" --modelName=gpt-4o-mini --provider=openai
    --help - Show this help message
Instructions:
    In another terminal, run: npx @brave/brave-search-mcp-server@1.3.6 --port=3002
    In another terminal, run: npx @modelcontextprotocol/server-everything streamableHttp --port=3001
    Set BRAVE_API_KEY environment variable with your Brave Search API key.
    You must use a model that supports tool calling.
Other examples:
   yarn node-mcp-subgraph "please structure this content: teacher, Elizabeth, hobby, basketball, favorite food is hamburger" --modelName=gpt-4o-mini --provider=openai
   yarn node-mcp-subgraph "Hello, how are you?" --modelName=gpt-4o-mini --provider=openai
`;

const BRAVE_MCP_PORT = 3002;
const EVERYTHING_MCP_PORT = 3001;

run();

async function run() {
  const { prompt, apiKey, modelName, provider } = parseArgs(usage);

  const llmComponent = new RemoteLLMComponent({
    id: 'mcp_llm_component',
    provider,
    modelName,
    defaultConfig: TEXT_CONFIG_SDK,
  });

  const braveMcpComponent = new MCPClientComponent({
    id: 'brave_mcp_component',
    sessionConfig: {
      transport: 'http',
      endpoint: `http://localhost:${BRAVE_MCP_PORT}/mcp`,
      authConfig: {
        type: 'http',
        config: { api_key: '{{BRAVE_API_KEY}}' },
      },
    },
  });

  const _everythingMcpComponent = new MCPClientComponent({
    id: 'everything_mcp_component',
    sessionConfig: {
      transport: 'http',
      endpoint: `http://localhost:${EVERYTHING_MCP_PORT}/mcp`,
      authConfig: {
        type: 'http',
        config: {
          api_key: 'fake_api_key',
        },
      },
    },
  });

  const builtInMCPSubgraphNode = new SubgraphNode({
    subgraphId: 'mcp_subgraph',
  });

  const graph = new GraphBuilder({
    id: 'node_custom_mcp_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(builtInMCPSubgraphNode)
    .addMCPSubgraph('mcp_subgraph', {
      llmComponent,
      mcpComponents: [
        braveMcpComponent,
        // everythingMcpComponent
      ],
      systemPrompt: SYSTEM_PROMPT,
    })
    .setStartNode(builtInMCPSubgraphNode)
    .setEndNode(builtInMCPSubgraphNode)
    .build();

  const { outputStream } = await graph.start([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);
  for await (const result of outputStream) {
    await result.processResponse({
      Custom: (messages: GraphTypes.Custom<LLMMessageInterface[]>) => {
        console.log('\n✅ Agent response:');
        if (messages && messages.length > 0 && messages[messages.length - 1]) {
          console.log(messages[messages.length - 1].content);
        } else {
          console.log('No valid response received');
        }
        // Access messages for the full history to be used in the next subgraph call.
      },
    });
  }
  stopInworldRuntime();
}
