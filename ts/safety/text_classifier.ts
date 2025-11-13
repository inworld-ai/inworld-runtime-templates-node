import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GraphBuilder,
  RemoteEmbedderComponent,
  TextClassifierNode,
} from '@inworld/runtime/graph';
import path from 'path';

const minimist = require('minimist');

const DEFAULT_TEXT_CLASSIFIER_WEIGHTS_MODEL_PATH = path.resolve(
  __dirname,
  'fixtures/text_classifier_model_weights.json',
);

const usage = `
Usage:
    yarn node-text-classifier "Let's discuss drugs and substance abuse in detail" \\
    --modelPath=<model-path>[optional, path to classifier model]

Examples:
    # Basic text classification
    yarn node-text-classifier "This is safe content" --modelPath="graph/fixtures/text_classifier_model_weights.json"

    # Check harmful content
    yarn node-text-classifier "I want to hurt myself" --modelPath="graph/fixtures/text_classifier_model_weights.json"
    `;

run();

async function run() {
  const { text, modelPath, apiKey } = parseArgs();

  // Create TextClassifierNode with supported classes from model weights
  const classifierNode = new TextClassifierNode({
    id: 'text_classifier_node',
    embedderComponentId: 'text_embedder_component',
    modelWeightsPath: modelPath,
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
        { label: 'substance', threshold: 0.4 },
      ],
    },
    reportToClient: false,
  });

  // Create the text embedder component that the TextClassifierNode expects
  const textEmbedderComponent = new RemoteEmbedderComponent({
    id: 'text_embedder_component',
    provider: 'inworld',
  });

  const graph = new GraphBuilder({
    id: 'node_text_classifier_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(textEmbedderComponent)
    .addNode(classifierNode)
    .setStartNode(classifierNode)
    .setEndNode(classifierNode)
    .build();

  const graphInput = text;

  try {
    const { outputStream } = await graph.start(graphInput);

    for await (const result of outputStream) {
      await result.processResponse({
        default: (data: any) => {
          // Analyze the classification response structure
          console.log('\n=== Classification Analysis ===');
          console.log('Detected Classes:', data.classes || []);
          console.log('Input Text:', data.text || text);
          console.log('Classification Result:', data);
        },
      });
    }
  } catch (error: any) {
    console.error('Text classification failed:', error.message);
  }
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
  modelPath: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const text = argv._?.join(' ') || '';
  const modelPath =
    argv.modelPath || DEFAULT_TEXT_CLASSIFIER_WEIGHTS_MODEL_PATH;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text to classify.\n${usage}`);
  }

  if (!modelPath) {
    throw new Error(`You need to provide --modelPath.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    text,
    modelPath,
    apiKey,
  };
}
