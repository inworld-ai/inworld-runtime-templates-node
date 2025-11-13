import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  KeywordMatcherNode,
  ProxyNode,
  RemoteEmbedderComponent,
  SubgraphBuilder,
  SubgraphNode,
  TextClassifierNode,
} from '@inworld/runtime/graph';
import * as fs from 'fs';
import path from 'path';

// Import our custom SafetyAggregatorNode
import { SafetyAggregatorCustomNode } from './safety_aggregator_node';

const minimist = require('minimist');

const DEFAULT_TEXT_CLASSIFIER_WEIGHTS_MODEL_PATH = path.resolve(
  __dirname,
  'fixtures/text_classifier_model_weights.json',
);
const DEFAULT_KEYWORD_MATCHER_PROFANITY_CONFIG_PATH = path.resolve(
  __dirname,
  'fixtures/profanity.json',
);
const DEFAULT_KEYWORD_MATCHER_ADULT_CONFIG_PATH = path.resolve(
  __dirname,
  'fixtures/adult.json',
);
const DEFAULT_KEYWORD_MATCHER_SUBSTANCE_USE_CONFIG_PATH = path.resolve(
  __dirname,
  'fixtures/substance_use.json',
);

const usage = `
Usage:
    yarn safety-subgraph "Let's discuss drugs and substance abuse in detail" \\
    --classifierWeightsModelPath=<classifier-weights-model-path>[optional, path to classifier model] \\
    --profanityPath=<profanity-path>[optional, path to profanity.json] \\
    --adultPath=<adult-path>[optional, path to adult.json] \\
    --substancePath=<substance-path>[optional, path to substance_use.json]

Examples:
    # Test safe content
    yarn safety-subgraph "I love pizza and learning" \\
      --classifierWeightsModelPath="graph/temp/model_weights_1.json" \\
      --profanityPath="graph/temp/profanity.json" \\
      --adultPath="graph/temp/adult.json" \\
      --substancePath="graph/temp/substance_use.json"

    # Test unsafe content (substance)  
    yarn safety-subgraph "Let's do drugs and get high" \\
      --classifierWeightsModelPath="graph/temp/model_weights_1.json" \\
      --profanityPath="graph/temp/profanity.json" \\
      --adultPath="graph/temp/adult.json" \\
      --substancePath="graph/temp/substance_use.json"
    `;

run();

async function run() {
  const {
    text,
    classifierWeightsModelPath,
    profanityPath,
    adultPath,
    substancePath,
    apiKey,
  } = parseArgs();

  // Load keywords from individual files
  const keywordFiles = [
    { name: 'profanity', path: profanityPath },
    { name: 'adult', path: adultPath },
    { name: 'substance_use', path: substancePath },
  ];

  let keywordGroups: Array<{ name: string; keywords: string[] }> = [];

  for (const { name, path: filePath } of keywordFiles) {
    try {
      const keywords = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (Array.isArray(keywords)) {
        keywordGroups.push({ name, keywords });
      }
    } catch (error) {
      throw new Error(
        `Could not load keywords from ${filePath}: ${error.message}`,
      );
    }
  }

  // Create the text embedder component
  const textEmbedderComponent = new RemoteEmbedderComponent({
    id: 'bge_embedder_component',
    provider: 'inworld',
  });

  // Create safety subgraph nodes
  const inputNode = new ProxyNode({ id: 'input_node' });

  const textClassifierNode = new TextClassifierNode({
    id: 'text_classifier_node',
    embedderComponentId: 'bge_embedder_component',
    modelWeightsPath: classifierWeightsModelPath,
    supportedClasses: [
      'hategroup',
      'selfharm',
      'sexual',
      'sexualminors',
      'substance',
    ],
    classifierConfig: {
      classes: [
        { label: 'hategroup', threshold: 0.8 },
        { label: 'selfharm', threshold: 0.9 },
        { label: 'sexual', threshold: 0.8 },
        { label: 'sexualminors', threshold: 0.9 },
        { label: 'substance', threshold: 0.7 },
      ],
    },
    reportToClient: false,
  });

  const keywordMatcherNode = new KeywordMatcherNode({
    id: 'keyword_matcher_node',
    keywords: keywordGroups as any,
    reportToClient: false,
  });

  // Create custom SafetyAggregatorNode
  const safetyAggregatorNode = new SafetyAggregatorCustomNode();

  // Build safety subgraph
  const safetySubgraph = new SubgraphBuilder('safety_subgraph')
    .addNode(inputNode)
    .addNode(textClassifierNode)
    .addNode(keywordMatcherNode)
    .addNode(safetyAggregatorNode)
    .addEdge(inputNode, textClassifierNode)
    .addEdge(inputNode, keywordMatcherNode)
    .addEdge(inputNode, safetyAggregatorNode)
    .addEdge(textClassifierNode, safetyAggregatorNode)
    .addEdge(keywordMatcherNode, safetyAggregatorNode)
    .setStartNode(inputNode)
    .setEndNode(safetyAggregatorNode);

  // Create subgraph node
  const safetySubgraphNode = new SubgraphNode({
    subgraphId: 'safety_subgraph',
  });

  // Build main graph with safety subgraph
  const graph = new GraphBuilder({
    id: 'safety_graph_main',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(textEmbedderComponent)
    .addSubgraph(safetySubgraph)
    .addNode(safetySubgraphNode)
    .setStartNode(safetySubgraphNode)
    .setEndNode(safetySubgraphNode)
    .build();

  try {
    const { outputStream } = await graph.start(text);

    for await (const result of outputStream) {
      await result.processResponse({
        SafetyResult: (safetyResult) => {
          console.log('\n=== Final Safety Result ===');
          console.log(
            `Safety Decision: ${safetyResult.isSafe ? 'SAFE' : 'UNSAFE'}`,
          );
          console.log(`Input Text: "${safetyResult.text}"`);
          if (safetyResult.classes && safetyResult.classes.length > 0) {
            console.log(
              `Classification violations: ${safetyResult.classes.join(', ')}`,
            );
          }
          if (
            safetyResult.keywordMatches &&
            safetyResult.keywordMatches.length > 0
          ) {
            console.log(
              `Keyword matches: ${safetyResult.keywordMatches.map((m: any) => m.keyword).join(', ')}`,
            );
          }
          console.log(`Result Type: SafetyResult`);
        },
        default: (data: any) => {
          console.log('\n=== Unhandled Safety Result ===');
          console.log(`Safety Decision: ${data.isSafe ? 'SAFE' : 'UNSAFE'}`);
          console.log(`Input Text: "${data.text}"`);
        },
      });
    }
  } catch (error: any) {
    console.error('\nSafety subgraph failed:', error.message);
  }
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
  classifierWeightsModelPath: string;
  profanityPath: string;
  adultPath: string;
  substancePath: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const text = argv._?.join(' ') || '';
  const classifierWeightsModelPath =
    argv.classifierWeightsModelPath ||
    DEFAULT_TEXT_CLASSIFIER_WEIGHTS_MODEL_PATH;
  const profanityPath =
    argv.profanityPath || DEFAULT_KEYWORD_MATCHER_PROFANITY_CONFIG_PATH;
  const adultPath = argv.adultPath || DEFAULT_KEYWORD_MATCHER_ADULT_CONFIG_PATH;
  const substancePath =
    argv.substancePath || DEFAULT_KEYWORD_MATCHER_SUBSTANCE_USE_CONFIG_PATH;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text to check for safety.\n${usage}`);
  }

  if (!classifierWeightsModelPath) {
    throw new Error(
      `You need to provide --classifierWeightsModelPath.\n${usage}`,
    );
  }

  if (!profanityPath) {
    throw new Error(`You need to provide --profanityPath.\n${usage}`);
  }

  if (!adultPath) {
    throw new Error(`You need to provide --adultPath.\n${usage}`);
  }

  if (!substancePath) {
    throw new Error(`You need to provide --substancePath.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    text,
    classifierWeightsModelPath,
    profanityPath,
    adultPath,
    substancePath,
    apiKey,
  };
}
