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
import * as fs from 'fs';
import * as path from 'path';

import { TEXT_CONFIG_SDK } from '../../shared/constants';
import { parseArgs } from '../../shared/helpers/cli_helpers';

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to external tools. 
When a user asks a question, you should determine if you need to use any available tools to answer their question.
If you need to use tools, make the appropriate tool calls with the correct parameters.
If you don't need tools, respond directly to the user.`;

const usage = `
Usage:
    yarn node-mcp-subgraph "What's the weather like in San Francisco?" --modelName=gpt-4o-mini --provider=openai
    --help - Show this help message
Instructions:
    This example connects to a mock weather MCP server via stdio.
    The weather server is automatically built when you run the templates setup.
    You must use a model that supports tool calling.
Other examples:
    yarn node-mcp-subgraph "What's the 3-day forecast for Tokyo?" --modelName=gpt-4o-mini --provider=openai
    yarn node-mcp-subgraph "How's the weather in London?" --modelName=gpt-4o-mini --provider=openai
`;

run();

/**
 * Check if the weather server is built, and provide instructions if not
 * @param {string} serverDir - Path to the weather server directory
 * @param {string} distPath - Path to the compiled server file
 */
function checkWeatherServerBuilt(serverDir: string, distPath: string): void {
  if (!fs.existsSync(distPath)) {
    console.error('❌ Weather MCP server not built.');
    console.error(
      `\nPlease build it first by running:\n  cd ${serverDir} && npm install && npm run build\n`,
    );
    process.exit(1);
  }
}

async function run() {
  try {
    const { prompt, apiKey, modelName, provider } = parseArgs(usage);

    const llmComponent = new RemoteLLMComponent({
      id: 'mcp_llm_component',
      provider,
      modelName,
      defaultConfig: TEXT_CONFIG_SDK,
    });

    const weatherServerDir = path.resolve(
      __dirname,
      'mcp-server-mocks/weather',
    );
    const weatherServerPath = path.resolve(weatherServerDir, 'dist/index.js');

    // Check if the weather server is built
    checkWeatherServerBuilt(weatherServerDir, weatherServerPath);
    const nodePath = process.execPath; // Use current node executable

    const weatherMcpComponent = new MCPClientComponent({
      id: 'weather_mcp_component',
      sessionConfig: {
        transport: 'stdio',
        endpoint: `${nodePath} ${weatherServerPath}`,
        authConfig: {
          type: 'stdio',
          config: {
            env: {
              NODE_ENV: 'development',
            },
          },
        },
      },
    });

    const builtInMCPSubgraphNode = new SubgraphNode({
      subgraphId: 'mcp_subgraph',
    });

    const graph = new GraphBuilder({
      id: 'node_mcp_weather_graph',
      apiKey,
      enableRemoteConfig: false,
    })
      .addNode(builtInMCPSubgraphNode)
      .addMCPSubgraph('mcp_subgraph', {
        llmComponent,
        mcpComponents: [weatherMcpComponent],
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
          console.log('✅ Agent response:');
          if (
            messages &&
            messages.length > 0 &&
            messages[messages.length - 1]
          ) {
            console.log(messages[messages.length - 1].content);
          } else {
            console.log('No valid response received');
          }
        },
      });
    }
  } catch (error) {
    console.error('Error running MCP subgraph:', error);
  } finally {
    stopInworldRuntime();
  }
}
