import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  ProxyNode,
  RemoteEmbedderComponent,
  RemoteLLMComponent,
  SubgraphBuilder,
  SubgraphNode,
} from '@inworld/runtime/graph';
import * as fs from 'fs';
import * as path from 'path';

import { LTMParallelLLMCustomNode } from './ltm_parallel_llm_node';
import { LTMPromptBuilderCustomNode } from './ltm_prompt_builder_node';
import { LTMResponseParserCustomNode } from './ltm_response_parser_node';
import { LTMTaskBuilderCustomNode } from './ltm_task_builder_node';

interface MemoryRecord {
  text: string;
  embedding: number[];
  topics: string[];
}

interface MemorySnapshot {
  flashMemory: MemoryRecord[];
  longTermMemory: MemoryRecord[];
}

interface MemoryUpdaterRequest {
  memorySnapshot: MemorySnapshot;
}

const minimist = require('minimist');

const DEFAULT_PROMPT_TEMPLATE_PATH = path.resolve(
  __dirname,
  'fixtures/ltm_prompt_template.txt',
);

const DEFAULT_INPUT_FILE_PATH = path.resolve(
  __dirname,
  'fixtures/test_memories.json',
);

const usage = `
Usage:
    yarn long-term-memory [options]

Options:
    --input=<path>              Path to JSON file with flash memories (default: fixtures/test_memories.json)
    --maxFlashMemory=<number>   Maximum number of flash memories to keep (default: 5)
    --promptTemplate=<path>     Path to prompt template file (optional)

Examples:
    # Process flash memories using default test data
    yarn long-term-memory

    # Process custom flash memories into long-term memories
    yarn long-term-memory --input="memory/test_memories.json" --maxFlashMemory=5

    # Use custom prompt template
    yarn long-term-memory --input="memory/test_memories.json" \\
      --promptTemplate="memory/custom_prompt.txt"
`;

run();

async function run() {
  const { inputFile, maxFlashMemory, promptTemplatePath, apiKey } = parseArgs();

  // Load input memories
  const inputData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const memoryRequest: MemoryUpdaterRequest = {
    memorySnapshot: {
      flashMemory: inputData.flashMemory || [],
      longTermMemory: inputData.longTermMemory || [],
    },
  };

  console.log('\n=== Long-Term Memory Processing ===');
  console.log(
    `Flash memories: ${memoryRequest.memorySnapshot.flashMemory.length}`,
  );
  console.log(
    `Existing LTMs: ${memoryRequest.memorySnapshot.longTermMemory.length}`,
  );

  // Count memories by topic
  const topicCounts = new Map<string, number>();
  for (const memory of memoryRequest.memorySnapshot.flashMemory) {
    for (const topic of memory.topics) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  console.log('\nInput memory distribution by topic:');
  for (const [topic, count] of topicCounts.entries()) {
    console.log(`  ${topic}: ${count} memories`);
  }

  // Load prompt template
  const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');

  // Create components
  const embedderComponent = new RemoteEmbedderComponent({
    id: 'embedder_component',
    provider: 'inworld',
    modelName: 'BAAI/bge-large-en-v1.5',
  });

  const llmComponent = new RemoteLLMComponent({
    id: 'llm_component',
    provider: 'inworld',
    modelName: 'meta-llama/Llama-3.1-70b-Instruct',
    defaultConfig: {
      temperature: 0.7,
      maxNewTokens: 800,
    },
  });

  // Create custom nodes
  const taskBuilderNode = new LTMTaskBuilderCustomNode({
    maxNumberOfFlashMemory: maxFlashMemory,
    maxTopicSummaryLenToAppend: 500,
  });

  const promptBuilderNode = new LTMPromptBuilderCustomNode({
    promptTemplate,
  });

  const responseParserNode = new LTMResponseParserCustomNode({
    embedderComponentId: 'embedder_component',
  });

  const parallelLLMNode = new LTMParallelLLMCustomNode('llm_component');

  // Build nodes
  const inputNode = new ProxyNode({ id: 'input_node' });

  // Build LTM subgraph
  const ltmSubgraph = new SubgraphBuilder('ltm_subgraph')
    .addNode(inputNode)
    .addNode(taskBuilderNode)
    .addNode(promptBuilderNode)
    .addNode(parallelLLMNode)
    .addNode(responseParserNode)
    .addEdge(inputNode, taskBuilderNode)
    .addEdge(taskBuilderNode, promptBuilderNode)
    .addEdge(promptBuilderNode, parallelLLMNode)
    .addEdge(inputNode, responseParserNode)
    .addEdge(taskBuilderNode, responseParserNode)
    .addEdge(parallelLLMNode, responseParserNode)
    .setStartNode(inputNode)
    .setEndNode(responseParserNode);

  const ltmSubgraphNode = new SubgraphNode({ subgraphId: 'ltm_subgraph' });

  // Build main graph
  const graph = new GraphBuilder({
    id: 'ltm_main_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(embedderComponent)
    .addComponent(llmComponent)
    .addSubgraph(ltmSubgraph)
    .addNode(ltmSubgraphNode)
    .setStartNode(ltmSubgraphNode)
    .setEndNode(ltmSubgraphNode)
    .build();

  try {
    // Create a custom wrapper for the memory request
    const requestWrapper = {
      value: memoryRequest,
    };

    const { outputStream } = await graph.start(requestWrapper);

    for await (const result of outputStream) {
      const data = result.data;

      // Check if data is directly the snapshot or needs unwrapping
      let snapshot = data;
      if (
        data &&
        typeof data === 'object' &&
        'value' in data &&
        !data.flashMemory
      ) {
        snapshot = data.value as any;
        // Unwrap nested value objects if needed
        while (
          snapshot &&
          typeof snapshot === 'object' &&
          'value' in snapshot &&
          !snapshot.flashMemory &&
          !snapshot.longTermMemory
        ) {
          snapshot = snapshot.value;
        }
      }

      if (snapshot && (snapshot.flashMemory || snapshot.longTermMemory)) {
        console.log('\n=== Memory Processing Results ===');
        console.log(
          `\nLong-Term Memories (${snapshot.longTermMemory?.length || 0} total):`,
        );

        if (snapshot.longTermMemory && snapshot.longTermMemory.length > 0) {
          for (let i = 0; i < snapshot.longTermMemory.length; i++) {
            const memory = snapshot.longTermMemory[i];
            console.log(`\nLTM #${i + 1}:`);
            console.log(`  Topic: ${memory.topics.join(', ')}`);
            console.log(`  Text: ${memory.text}`);
            console.log(`  Embedding size: ${memory.embedding?.length || 0}`);
          }
        } else {
          console.log('  No long-term memories created.');
        }

        console.log(
          `\nRemaining Flash Memories (${snapshot.flashMemory?.length || 0} total):`,
        );
        if (snapshot.flashMemory && snapshot.flashMemory.length > 0) {
          for (let i = 0; i < snapshot.flashMemory.length; i++) {
            const memory = snapshot.flashMemory[i];
            console.log(`\nFlash #${i + 1}:`);
            console.log(`  Topics: ${memory.topics.join(', ')}`);
            console.log(`  Text: ${memory.text.substring(0, 100)}...`);
          }
        } else {
          console.log('  No flash memories remaining.');
        }
      }
    }
  } catch (error: any) {
    console.error('\nLTM processing failed:', error.message);
    console.error(error.stack);
  }

  stopInworldRuntime();
}

function parseArgs(): {
  inputFile: string;
  maxFlashMemory: number;
  promptTemplatePath: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const inputFile = argv.input || DEFAULT_INPUT_FILE_PATH;
  const maxFlashMemory = parseInt(argv.maxFlashMemory) || 5;
  const promptTemplatePath =
    argv.promptTemplate || DEFAULT_PROMPT_TEMPLATE_PATH;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    inputFile,
    maxFlashMemory,
    promptTemplatePath,
    apiKey,
  };
}
