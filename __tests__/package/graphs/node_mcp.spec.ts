import * as allure from 'allure-js-commons';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';

import { runExample } from '../helpers/run-example';

// Test data for MCP subgraph scenarios
const mcpSubgraphScenarios = [
  {
    name: 'brave server weather query',
    description: 'that calls brave server',
    args: [
      '"What\'s the weather like in San Francisco?"',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedContent: 'weather',
  },
  /*  {
    name: 'everything server content structuring',
    description: 'that calls everything server',
    args: [
      '"please structure this content: teacher, Elizabeth, hobby, basketball, favorite food is hamburger"',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedContent: '- **hobby',
  },*/
  {
    name: 'no server calls',
    description: 'that does not call any server',
    args: [
      '"Hello, how are you?"',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ],
    expectedContent: 'hello',
  },
];

// FIXME:
describe.skip('Graph Template mcp', () => {
  let braveServerProcess: ChildProcess;
  let everythingServerProcess: ChildProcess;

  beforeAll(async () => {
    const braveApiKey = process.env.BRAVE_API_KEY || 'test-api-key-for-testing';
    const isWindows = process.platform === 'win32';

    // Start Brave server
    const braveCommand = isWindows ? 'cmd' : 'npx';
    const braveNpxArgs = [
      '@brave/brave-search-mcp-server@1.3.6',
      '--port=3002',
      '--brave-api-key',
      braveApiKey,
    ];
    const braveArgs = isWindows ? ['/c', 'npx', ...braveNpxArgs] : braveNpxArgs;

    braveServerProcess = spawn(braveCommand, braveArgs, {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, BRAVE_API_KEY: braveApiKey },
    });

    // Start Everything server
    const everythingCommand = isWindows ? 'cmd' : 'npx';
    const everythingNpxArgs = [
      '@modelcontextprotocol/server-everything',
      'streamableHttp',
      '--port=3001',
    ];
    const everythingArgs = isWindows
      ? ['/c', 'npx', ...everythingNpxArgs]
      : everythingNpxArgs;

    everythingServerProcess = spawn(everythingCommand, everythingArgs, {
      detached: true,
      stdio: 'ignore',
    });

    // Wait for both servers to be ready
    await Promise.all([
      waitForServer(3002, 'Brave MCP Server'),
      waitForServer(3001, 'Everything MCP Server'),
    ]);
  }, 60000);

  afterAll(async () => {
    const servers = [
      { name: 'Brave', process: braveServerProcess },
      { name: 'Everything', process: everythingServerProcess },
    ];

    for (const server of servers) {
      if (
        !server.process ||
        !server.process.pid ||
        server.process.exitCode !== null
      ) {
        console.log(
          `${server.name} server was not running or already stopped.`,
        );
        continue;
      }

      const { pid } = server.process;
      console.log(`Stopping ${server.name} server with PID: ${pid}`);

      const exitPromise = new Promise<void>((resolve) => {
        server.process.on('exit', resolve);
      });

      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
        } else {
          process.kill(-pid, 'SIGKILL');
        }
      } catch (e) {
        console.error(
          `Failed to send kill signal for ${server.name} server, process may have already exited:`,
          e,
        );
      }

      await Promise.race([
        exitPromise,
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }

    console.log('All MCP servers stop sequence complete.');
  }, 20000);

  // Helper function to wait for server to be ready
  async function waitForServer(
    port: number,
    serverName: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const pollInterval = 500;
      const timeout = 30000;

      const pollTimer = setInterval(() => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          console.log(
            `[${serverName} Poll]: Server responded with status ${res.statusCode}. Ready.`,
          );
          clearInterval(pollTimer);
          clearTimeout(startupTimeout);
          res.resume();
          resolve();
        });

        req.on('error', () => {
          // Ignore connection errors (like ECONNREFUSED) and retry.
        });
      }, pollInterval);

      const startupTimeout = setTimeout(() => {
        clearInterval(pollTimer);
        reject(
          new Error(
            `${serverName} on port ${port} did not respond within ${timeout}ms`,
          ),
        );
      }, timeout);
    });
  }

  it(`should run node-custom-mcp successfully @allure.id:${getAllureId(
    'node-custom-mcp',
  )}`, async () => {
    const templateName = 'node-custom-mcp';
    const args = [
      '"What\'s the weather like in San Francisco?"',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
      '--port=3002',
    ];

    await allure.suite('Tests for node-custom-mcp');

    try {
      const { output, errorOutput, exitCode } = await runExample(
        templateName,
        args,
      );

      if (errorOutput) {
        console.log('errorOutput:', errorOutput);
      }
      expect(exitCode).toBe(0);

      console.log(`✅ ${templateName} completed successfully`);
      console.log(`   Args: ${args.join(' ')}`);
      if (output.trim()) {
        console.log(
          `   Output: ${output.trim().substring(0, 100)}${
            output.length > 100 ? '...' : ''
          }`,
        );
      }
    } catch (error) {
      console.error(`❌ ${templateName} failed:`, error);
      throw error;
    }
  }, 120000);

  for (const scenario of mcpSubgraphScenarios) {
    it(`should run node-mcp-subgraph successfully ${scenario.description} @allure.id:${getAllureId(
      'node-mcp-subgraph',
    )}`, async () => {
      const templateName = 'node-mcp-subgraph';

      await allure.suite('Tests for node-mcp-subgraph');

      try {
        const { output, errorOutput, exitCode } = await runExample(
          templateName,
          scenario.args,
        );

        if (errorOutput) {
          console.log('errorOutput:', errorOutput);
        }
        expect(exitCode).toBe(0);

        console.log(`✅ ${templateName} completed successfully`);
        console.log(`   Args: ${scenario.args.join(' ')}`);
        if (output.trim()) {
          console.log(
            `   Output: ${output.trim().substring(0, 100)}${
              output.length > 100 ? '...' : ''
            }`,
          );
          expect(output.toLowerCase()).toContain(
            scenario.expectedContent.toLowerCase(),
          );
        }
      } catch (error) {
        console.error(`❌ ${templateName} failed:`, error);
        throw error;
      }
    }, 120000);
  }
});

function getAllureId(templateName: string): number {
  const idMap: Record<string, number> = {
    'node-custom-mcp': 7538,
    'node-mcp-subgraph': 7542,
  };

  return idMap[templateName] || 6000;
}
