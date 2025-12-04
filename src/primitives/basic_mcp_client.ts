/**
 * Basic MCP Client Template
 *
 * This example demonstrates Model Context Protocol (MCP) client usage with
 * the Inworld SDK. MCP enables LLMs to interact with external tools and
 * services through a standardized protocol.
 *
 * MCP is essential for:
 * - Function calling and tool execution
 * - Extending LLM capabilities with external APIs
 * - Building agentic systems
 * - Integrating third-party services
 * - Creating custom tool ecosystems
 *
 * Modes:
 * --mode=basic          : List and call tools from MCP server
 * --mode=tools          : Explore tool schemas and capabilities
 * --mode=batch          : Batch process multiple tool calls
 * --mode=integration    : Integration with LLM for function calling
 *
 * Usage:
 * yarn basic-mcp-client --mode=basic
 * yarn basic-mcp-client --mode=tools --server=http://localhost:3000
 * yarn basic-mcp-client --mode=batch
 * yarn basic-mcp-client --mode=integration
 */

import { InworldError } from '@inworld/runtime/common';
import { LLM } from '@inworld/runtime/primitives/llm';
import { MCPClient } from '@inworld/runtime/primitives/mcp';
const minimist = require('minimist');

const usage = `
Usage:
    yarn basic-mcp-client \n
    --mode=basic|tools|batch|integration[optional, default=basic] \n
    --server=<mcp-server-url>[optional, default=http://localhost:3000] \n
    --command=<local-command>[optional, for local stdio transport]
    
Note: Requires an MCP server to be running (HTTP or stdio)
Example servers: https://github.com/modelcontextprotocol/servers`;

interface Args {
  mode: 'basic' | 'tools' | 'batch' | 'integration';
  server?: string;
  command?: string;
  help?: boolean;
}

function parseArgs(): Args {
  const argv = minimist(process.argv.slice(2));

  if (argv.help || argv.h) {
    console.log(usage);
    process.exit(0);
  }

  return {
    mode: argv.mode || 'basic',
    server: argv.server || 'http://localhost:3000',
    command: argv.command,
  };
}

/**
 * Basic MCP Example
 * Demonstrates listing and calling tools from an MCP server
 */
async function runBasicExample(serverUrl?: string, command?: string) {
  console.log('\n=== Basic MCP Example ===\n');

  try {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      console.error('❌ INWORLD_API_KEY environment variable is required');
      process.exit(1);
    }

    // Create MCP client
    console.log('Creating MCP client...');

    let mcpClient;
    if (command) {
      // Local stdio transport
      console.log(`Connecting to local MCP server: ${command}`);

      mcpClient = await MCPClient.create({
        sessionConfig: {
          transport: 'stdio',
          endpoint: command,
          stdioConfig: {
            env: process.env as Record<string, string>,
          },
        },
      });
    } else {
      // Remote HTTP transport
      console.log(`Connecting to MCP server: ${serverUrl}`);
      mcpClient = await MCPClient.create({
        sessionConfig: {
          transport: 'http',
          endpoint: serverUrl,
          httpConfig: {
            apiKey: apiKey,
            defaultTimeout: '30s',
          },
        },
      });
    }

    console.log('MCP client created!\n');

    // List available tools
    console.log('📋 Listing available tools...');
    const toolList = await mcpClient.listTools();
    console.log(`Found ${toolList.tools.length} tools:\n`);

    toolList.tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description || 'No description'}`);
      if (tool.properties) {
        const schema =
          typeof tool.properties === 'string'
            ? JSON.parse(tool.properties)
            : tool.properties;
        const params = Object.keys(schema.properties || {});
        if (params.length > 0) {
          console.log(`   Parameters: ${params.join(', ')}`);
        }
      }
      console.log();
    });

    // Call a tool if available
    if (toolList.tools.length > 0) {
      const firstTool = toolList.tools[0];
      console.log(`🔧 Calling tool: ${firstTool.name}`);
      console.log(
        '────────────────────────────────────────────────────────────',
      );

      try {
        // Create sample arguments based on tool schema
        const args: Record<string, any> = {};
        if (firstTool.properties) {
          const schema =
            typeof firstTool.properties === 'string'
              ? JSON.parse(firstTool.properties)
              : firstTool.properties;

          // Fill in sample values for required parameters
          if (schema.properties) {
            Object.entries(schema.properties).forEach(
              ([key, prop]: [string, any]) => {
                if (prop.type === 'string') {
                  args[key] = 'sample';
                } else if (prop.type === 'number') {
                  args[key] = 42;
                } else if (prop.type === 'boolean') {
                  args[key] = true;
                }
              },
            );
          }
        }

        console.log(`Arguments: ${JSON.stringify(args, null, 2)}`);

        const result = await mcpClient.callTool(firstTool.name, args);
        console.log(`\n✅ Tool result:\n${result.result}`);
      } catch (error) {
        console.log(`\n⚠️  Tool call failed: ${error.message}`);
        console.log('(This is expected if the sample arguments are invalid)');
      }
    } else {
      console.log('⚠️  No tools available on the server');
    }
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Tools Exploration Example
 * Demonstrates exploring tool schemas and capabilities
 */
async function runToolsExample(serverUrl?: string, _command?: string) {
  console.log('\n=== Tools Exploration Example ===\n');

  try {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      console.error('❌ INWORLD_API_KEY environment variable is required');
      process.exit(1);
    }

    // Create MCP client
    console.log('Creating MCP client...');
    const mcpClient = await MCPClient.create({
      sessionConfig: {
        transport: 'http',
        endpoint: serverUrl || 'http://localhost:3000',
        httpConfig: {
          apiKey: apiKey,
          defaultTimeout: '30s',
        },
      },
    });
    console.log('MCP client created!\n');

    // Get all tool names
    console.log('📊 Tool Analysis');
    console.log(
      '════════════════════════════════════════════════════════════\n',
    );

    const toolNames = await mcpClient.getToolNames();
    console.log(`Total tools: ${toolNames.length}`);
    console.log(`Tool names: ${toolNames.join(', ')}\n`);

    // Explore each tool in detail
    const toolList = await mcpClient.listTools();

    for (const tool of toolList.tools) {
      console.log(`\n🔧 ${tool.name}`);
      console.log(
        '────────────────────────────────────────────────────────────',
      );
      console.log(`Description: ${tool.description || 'No description'}`);

      if (tool.properties) {
        const schema =
          typeof tool.properties === 'string'
            ? JSON.parse(tool.properties)
            : tool.properties;

        console.log('\n📝 Schema:');
        console.log(JSON.stringify(schema, null, 2));

        if (schema.properties) {
          console.log('\n📋 Parameters:');
          Object.entries(schema.properties).forEach(
            ([key, prop]: [string, any]) => {
              const required = schema.required?.includes(key)
                ? ' (required)'
                : '';
              const type = prop.type || 'unknown';
              const description = prop.description || '';
              console.log(`  • ${key}${required}`);
              console.log(`    Type: ${type}`);
              if (description) {
                console.log(`    Description: ${description}`);
              }
            },
          );
        }
      } else {
        console.log('No schema available');
      }
    }

    // Filter tools by category
    console.log('\n\n🏷️  Tool Categorization');
    console.log(
      '════════════════════════════════════════════════════════════\n',
    );

    const categories = {
      calculation: await mcpClient.filterTools(
        (tool) =>
          tool.description?.toLowerCase().includes('math') ||
          tool.description?.toLowerCase().includes('calculate') ||
          tool.name.toLowerCase().includes('calc'),
      ),
      search: await mcpClient.filterTools(
        (tool) =>
          tool.description?.toLowerCase().includes('search') ||
          tool.description?.toLowerCase().includes('find') ||
          tool.description?.toLowerCase().includes('query'),
      ),
      data: await mcpClient.filterTools(
        (tool) =>
          tool.description?.toLowerCase().includes('data') ||
          tool.description?.toLowerCase().includes('database') ||
          tool.description?.toLowerCase().includes('store'),
      ),
    };

    Object.entries(categories).forEach(([category, tools]) => {
      console.log(`${category.toUpperCase()}: ${tools.length} tools`);
      if (tools.length > 0) {
        tools.forEach((tool) => console.log(`  • ${tool.name}`));
      }
      console.log();
    });
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Batch Processing Example
 * Demonstrates calling multiple tools in sequence
 */
async function runBatchExample(serverUrl?: string, _command?: string) {
  console.log('\n=== Batch Processing Example ===\n');

  try {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      console.error('❌ INWORLD_API_KEY environment variable is required');
      process.exit(1);
    }

    // Create MCP client
    console.log('Creating MCP client...');
    const mcpClient = await MCPClient.create({
      sessionConfig: {
        transport: 'http',
        endpoint: serverUrl || 'http://localhost:3000',
        httpConfig: {
          apiKey: apiKey,
          defaultTimeout: '30s',
        },
      },
    });
    console.log('MCP client created!\n');

    // Check for calculator tool
    console.log('Checking for calculator tool...');
    const hasCalculator = await mcpClient.hasTool('calculator');

    if (!hasCalculator) {
      console.log('⚠️  Calculator tool not found. Using mock data.\n');

      // Simulate batch processing with available tools
      const toolList = await mcpClient.listTools();
      if (toolList.tools.length === 0) {
        console.log('No tools available on the server');
        return;
      }

      console.log('🔄 Processing batch of tool calls...\n');

      const calls = toolList.tools.slice(0, 3).map((tool, i) => ({
        id: `call-${i + 1}`,
        name: tool.name,
        args: JSON.stringify({}),
      }));

      console.log(`Calling ${calls.length} tools:`);
      calls.forEach((call) => console.log(`  • ${call.name}`));

      const startTime = Date.now();
      const results = await mcpClient.callBatch(calls);
      const duration = Date.now() - startTime;

      console.log(`\n✅ Batch completed in ${duration}ms\n`);

      results.forEach((result, i) => {
        console.log(`${i + 1}. ${calls[i].name}`);
        console.log(`   Result: ${result.result.substring(0, 100)}...`);
      });
    } else {
      // Example with calculator
      console.log('✓ Calculator tool found!\n');

      const calculations = [
        { operation: 'add', a: 10, b: 5 },
        { operation: 'subtract', a: 20, b: 8 },
        { operation: 'multiply', a: 6, b: 7 },
        { operation: 'divide', a: 100, b: 4 },
      ];

      console.log('🧮 Performing calculations:');
      calculations.forEach((calc) => {
        console.log(`  • ${calc.operation}(${calc.a}, ${calc.b})`);
      });

      const calls = calculations.map((calc, i) => ({
        id: `calc-${i + 1}`,
        name: 'calculator',
        args: JSON.stringify(calc),
      }));

      console.log('\n🔄 Processing batch...');
      const startTime = Date.now();
      const results = await mcpClient.callBatch(calls);
      const duration = Date.now() - startTime;

      console.log(`\n✅ Batch completed in ${duration}ms\n`);
      console.log('📊 Results:');
      console.log(
        '────────────────────────────────────────────────────────────',
      );

      results.forEach((result, i) => {
        const calc = calculations[i];
        console.log(
          `${calc.operation}(${calc.a}, ${calc.b}) = ${result.result}`,
        );
      });

      console.log(
        `\n⏱️  Average time per call: ${(duration / calls.length).toFixed(2)}ms`,
      );
      console.log(
        `📈 Throughput: ${((calls.length / duration) * 1000).toFixed(1)} calls/sec`,
      );
    }
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * LLM Integration Example
 * Demonstrates using MCP tools with LLM for function calling
 */
async function runIntegrationExample(serverUrl?: string, _command?: string) {
  console.log('\n=== LLM Integration Example ===\n');

  try {
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      console.error('❌ INWORLD_API_KEY environment variable is required');
      process.exit(1);
    }

    // Create MCP client
    console.log('Step 1: Creating MCP client...');
    const mcpClient = await MCPClient.create({
      sessionConfig: {
        transport: 'http',
        endpoint: serverUrl || 'http://localhost:3000',
        httpConfig: {
          apiKey: apiKey,
          defaultTimeout: '30s',
        },
      },
    });
    console.log('✓ MCP client created\n');

    // List tools and convert to LLM tool format
    console.log('Step 2: Fetching available tools...');
    const toolList = await mcpClient.listTools();
    console.log(`✓ Found ${toolList.tools.length} tools\n`);

    // Convert MCP tools to LLM tool format
    const llmTools = toolList.tools.map((tool) => {
      const schema = tool.properties
        ? typeof tool.properties === 'string'
          ? JSON.parse(tool.properties)
          : tool.properties
        : {};

      return {
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`,
        parameters: schema,
      };
    });

    // Create LLM instance
    console.log('Step 3: Creating LLM instance...');
    const llm = await LLM.create({
      remoteConfig: {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        apiKey,
        defaultTimeout: { seconds: 30 },
        defaultConfig: {
          maxNewTokens: 500,
          temperature: 0.7,
          topP: 0.9,
        },
      },
    });
    console.log('✓ LLM instance created\n');

    // Example conversation with tool calling
    console.log('Step 4: Running conversation with tool calling...');
    console.log(
      '════════════════════════════════════════════════════════════\n',
    );

    const userQuery = 'What tools do you have access to?';
    console.log(`User: ${userQuery}\n`);

    // Generate response with tools
    const messages = [
      {
        role: 'system',
        content: `You are a helpful assistant with access to various tools. 
Available tools: ${toolList.tools.map((t) => t.name).join(', ')}.
Use these tools when appropriate to help the user.`,
      },
      {
        role: 'user',
        content: userQuery,
      },
    ];

    console.log('Assistant: Generating response with available tools...\n');

    const result = await llm.generateContentChatComplete({
      messages: messages as any,
      tools: llmTools as any,
      toolChoice: { type: 'auto' },
      config: {
        maxNewTokens: 500,
        maxPromptLength: 2048,
        temperature: 0.7,
        topP: 0.9,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        repetitionPenalty: 1.0,
      },
    });

    const fullResponse = result.content || '';
    const toolCalls = result.toolCalls || [];

    console.log(fullResponse);
    console.log('\n');

    // Execute tool calls if any
    if (toolCalls.length > 0) {
      console.log(`\n🔧 LLM requested ${toolCalls.length} tool calls:\n`);

      for (const toolCall of toolCalls) {
        console.log(`Tool: ${toolCall.name}`);
        console.log(`Arguments: ${toolCall.args}`);

        try {
          const args = JSON.parse(toolCall.args);
          const result = await mcpClient.callTool(toolCall.name, args);
          console.log(`Result: ${result.result}\n`);
        } catch (error) {
          console.log(`Error: ${error.message}\n`);
        }
      }
    }

    console.log('════════════════════════════════════════════════════════════');
    console.log('\n✅ Integration example complete!');
    console.log('\nThis demonstrates how MCP tools can be:');
    console.log('  • Discovered from MCP server');
    console.log('  • Converted to LLM tool format');
    console.log('  • Used by LLM for function calling');
    console.log('  • Executed via MCP client');
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs();

  console.log('🔌 Inworld MCP Client Template');
  console.log('═══════════════════════════════════════════════════════════');

  switch (args.mode) {
    case 'basic':
      await runBasicExample(args.server, args.command);
      break;

    case 'tools':
      await runToolsExample(args.server, args.command);
      break;

    case 'batch':
      await runBatchExample(args.server, args.command);
      break;

    case 'integration':
      await runIntegrationExample(args.server, args.command);
      break;

    default:
      console.error(`\n❌ Unknown mode: ${args.mode}`);
      console.log(usage);
      process.exit(1);
  }
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
