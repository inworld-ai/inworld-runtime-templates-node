import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { GraphBuilder, ProxyNode, SubgraphNode } from '@inworld/runtime/graph';
import * as fs from 'fs';
import * as path from 'path';
import { v7 } from 'uuid';

const promptTemplate = fs.readFileSync(
  path.resolve(__dirname, 'fixtures/intent_matching_prompt_template.txt'),
  'utf-8',
);

const DEFAULT_INTENTS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'fixtures/intents.json'), 'utf-8'),
);

const minimist = require('minimist');

const usage = `
Usage:
    yarn node-intent "Tell me about that hogwarts of yours" (should match via embeddings) \\n
    OR \\n
    yarn node-intent "Tell me about that wizard castle dumbledore rules over?" (should match via LLM fallback) \\n
    OR \n
    yarn node-intent --file=path/to/intents.json`;

run();

async function run() {
  const { text, intents } = parseArgs();

  const builtInIntentSubgraphNode = new SubgraphNode({
    subgraphId: 'intent_subgraph',
  });

  const inputProxyNode = new ProxyNode();

  const outputProxyNode = new ProxyNode();

  const graphBuilder = new GraphBuilder({
    id: 'node_intent_graph',
    enableRemoteConfig: false,
  })
    .addIntentSubgraph('intent_subgraph', {
      intents,
      promptTemplate,
      similarityThreshold: 0.1, // threshold for being included in LLM fallback prompt
      embeddingSimilarityThreshold: 0.88, // threshold for intent matching via embeddings
      llmComponent: {
        provider: 'openai',
        modelName: 'gpt-4o-mini',
      },
    })
    .addNode(inputProxyNode)
    .addNode(builtInIntentSubgraphNode)
    .addNode(outputProxyNode)
    .addEdge(inputProxyNode, builtInIntentSubgraphNode)
    .addEdge(builtInIntentSubgraphNode, outputProxyNode)
    .setStartNode(inputProxyNode)
    .setEndNode(outputProxyNode);

  const graph = graphBuilder.build();

  const { outputStream } = await graph.start(text, { executionId: v7() });

  for await (const response of outputStream) {
    await response.processResponse({
      MatchedIntents: (matchedIntents) => {
        console.log('Intent matches:', matchedIntents.intents);
      },
    });
  }
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
  intents: {
    name: string;
    phrases: string[];
  }[];
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  let text = '';

  let intents = DEFAULT_INTENTS;

  if (argv.file) {
    const filePath = path.resolve(argv.file);
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      intents = JSON.parse(fileContent);
      console.log(`Reading input from file: ${filePath}`);
    } catch (error) {
      throw new Error(`Error reading file: ${error.message}\n${usage}`);
    }
  }
  text = argv._?.join(' ');

  if (!text) {
    throw new Error(`You need to provide the text to match intents.\n${usage}`);
  }

  return { text, intents };
}
