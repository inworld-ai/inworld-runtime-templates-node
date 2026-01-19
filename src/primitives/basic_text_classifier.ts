import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { DeviceRegistry, DeviceType } from '@inworld/runtime/core';
import { TextEmbedder } from '@inworld/runtime/primitives/embeddings';
import { TextClassifier } from '@inworld/runtime/primitives/nlu';
import path from 'path';

const minimist = require('minimist');

const DEFAULT_CLASSIFIER_MODEL_PATH = path.resolve(
  __dirname,
  '../shared/fixtures/text_classifier_model_weights.json',
);

const usage = `
Usage:
    npm run basic-text-classifier -- \n
    --mode=safety|batch|validation|threshold[optional, default=safety] \n
    --modelPath=<path-to-model-weights>[optional, default=fixtures/text_classifier_model_weights.json] \n
    --embedderModel=<embedder-model-path>[optional, for local embedder]`;

run();

async function run() {
  const { mode, modelPath, embedderModel } = parseArgs();

  try {
    // Create embedder (required for text classifier)
    console.log('Initializing text embedder...');
    const embedder = await createEmbedder(embedderModel);

    // Create text classifier with embedder
    console.log('Creating text classifier...');
    const classifier = await TextClassifier.create(embedder, {
      modelWeightsPath: modelPath,
      supportedClasses: [
        'hategroup',
        'selfharm',
        'sexual',
        'sexualminors',
        'substance',
      ],
    });

    console.log('Text classifier ready!\n');

    switch (mode) {
      case 'safety':
        await runSafetyModerationExample(classifier);
        break;
      case 'batch':
        await runBatchClassificationExample(classifier);
        break;
      case 'validation':
        await runContentValidationExample(classifier);
        break;
      case 'threshold':
        await runThresholdTuningExample(classifier);
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
 * Create text embedder for classifier
 *
 * @param {string} embedderModel - Optional local model path
 * @returns {Promise<TextEmbedder>} Text embedder instance
 */
async function createEmbedder(embedderModel?: string): Promise<TextEmbedder> {
  if (embedderModel) {
    // Use local embedder model
    const devices = await DeviceRegistry.getAvailableDevices();
    const cpuDevice = devices.find((d) => d.type === DeviceType.CPU);

    if (!cpuDevice) {
      throw new Error('No CPU device found for local embedder');
    }

    return await TextEmbedder.create({
      modelPath: embedderModel,
      device: {
        type: cpuDevice.type,
        index: cpuDevice.index,
      },
    });
  } else {
    // Use remote embedder
    const apiKey = process.env.INWORLD_API_KEY;
    if (!apiKey) {
      throw new Error(
        'INWORLD_API_KEY environment variable required for remote embedder',
      );
    }

    return await TextEmbedder.create({
      modelName: 'BAAI/bge-large-en-v1.5',
      provider: 'inworld',
      apiKey,
      defaultTimeout: '60s',
    });
  }
}

/**
 * Safety moderation example - Detect harmful content
 *
 * @param {TextClassifier} classifier - Text classifier instance
 */
async function runSafetyModerationExample(classifier: TextClassifier) {
  console.log('=== Safety Moderation Example ===\n');

  const messages = [
    'Hello! How are you today?',
    'I want to hurt myself and end it all',
    "Let's talk about adult content and sexual topics",
    'I hate those people, they should all be eliminated',
    'Can you help me get drugs and alcohol?',
    'This is a perfectly safe message with no issues',
    'Have you seen the new movie? It was amazing!',
  ];

  for (const message of messages) {
    console.log(`Message: "${message}"`);

    // Check if unsafe using classifyText
    const result = await classifier.classifyText({ text: message });
    const isUnsafe = result.classes.length > 0;

    if (!isUnsafe) {
      console.log('  ✅ SAFE - No harmful content detected\n');
      continue;
    }

    console.log(
      `  ⚠️  UNSAFE - Detected ${result.classes.length} safety issue(s):`,
    );
    result.classes.forEach((className: string) => {
      console.log(`      - ${className}`);
    });

    // Show primary concern
    if (result.classes.length > 0) {
      console.log(`  🚨 Primary concern: ${result.classes[0]}`);
    }
    console.log();
  }
}

/**
 * Batch classification example - Process multiple texts efficiently
 *
 * @param {TextClassifier} classifier - Text classifier instance
 */
async function runBatchClassificationExample(classifier: TextClassifier) {
  console.log('=== Batch Classification Example ===\n');

  const userMessages = [
    'I love this product!',
    'This makes me want to harm myself',
    'Great service, very helpful',
    "Let's discuss inappropriate adult topics",
    'Thank you for your help',
    'I need drugs to feel better',
    'Can you recommend a good restaurant?',
    'I hate those people, they are terrible',
  ];

  console.log(`Processing ${userMessages.length} messages in batch...\n`);

  const requests = userMessages.map((text) => ({ text }));
  const results = await classifier.classifyBatch(requests);

  let safeCount = 0;
  let unsafeCount = 0;

  results.forEach((result, index) => {
    const message = userMessages[index];
    const isSafe = result.classes.length === 0;

    if (isSafe) {
      safeCount++;
      console.log(`✅ [${index + 1}] SAFE: "${message}"`);
    } else {
      unsafeCount++;
      const categories = result.classes.join(', ');
      console.log(`⚠️  [${index + 1}] UNSAFE [${categories}]: "${message}"`);
    }
  });

  console.log('\n📊 Summary:');
  console.log(`   Safe messages: ${safeCount}/${userMessages.length}`);
  console.log(`   Unsafe messages: ${unsafeCount}/${userMessages.length}`);
  console.log(
    `   Safety rate: ${((safeCount / userMessages.length) * 100).toFixed(1)}%`,
  );
}

/**
 * Content validation example - Check for specific categories
 *
 * @param {TextClassifier} classifier - Text classifier instance
 */
async function runContentValidationExample(classifier: TextClassifier) {
  console.log('=== Content Validation Example ===\n');

  const testCases = [
    {
      text: 'I want to hurt myself',
      checkCategories: ['selfharm'],
      description: 'Self-harm check',
    },
    {
      text: 'Those people are terrible and should be eliminated',
      checkCategories: ['hategroup'],
      description: 'Hate speech check',
    },
    {
      text: 'Let me tell you about drugs and getting high',
      checkCategories: ['substance'],
      description: 'Substance abuse check',
    },
    {
      text: 'Explicit sexual content discussion',
      checkCategories: ['sexual', 'sexualminors'],
      description: 'Sexual content check',
    },
    {
      text: 'This is a completely safe message about cooking recipes',
      checkCategories: ['hategroup', 'selfharm', 'sexual', 'substance'],
      description: 'Safe content check',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n${testCase.description}:`);
    console.log(`Text: "${testCase.text}"`);
    console.log(`Checking for: [${testCase.checkCategories.join(', ')}]`);

    const containsCategory = await classifier.containsCategories(
      { text: testCase.text },
      testCase.checkCategories,
    );

    if (containsCategory) {
      console.log('  ⚠️  WARNING: Contains flagged category');

      // Get detailed results
      const result = await classifier.classifyText({ text: testCase.text });
      const matchedCategories = result.classes.filter((cls: string) =>
        testCase.checkCategories.includes(cls),
      );

      matchedCategories.forEach((className: string) => {
        console.log(`      - ${className}`);
      });
    } else {
      console.log('  ✅ PASSED: No flagged categories detected');
    }
  }

  // Advanced filtering example
  console.log('\n\x1b[33mAdvanced Filtering Example:\x1b[0m\n');

  const message = 'I hate those people and want to hurt myself with drugs';
  console.log(`Complex message: "${message}"\n`);

  const result = await classifier.classifyText({ text: message });

  if (result.classes.length === 0) {
    console.log('No safety issues detected');
  } else {
    console.log('Multiple safety concerns detected:');
    result.classes.forEach((className: string) => {
      console.log(`     - ${className}`);
    });
  }
}

/**
 * Threshold tuning example - Show how threshold affects results
 *
 * @param {TextClassifier} classifier - Text classifier instance
 */
async function runThresholdTuningExample(classifier: TextClassifier) {
  console.log('=== Threshold Tuning Example ===\n');

  const testMessage = "Let's discuss substance use and getting high";
  const thresholds = [0.3, 0.5, 0.7, 0.9];
  const supportedClasses = [
    'hategroup',
    'selfharm',
    'sexual',
    'sexualminors',
    'substance',
  ];

  console.log(`Test message: "${testMessage}"\n`);
  console.log('Testing different confidence thresholds:\n');

  for (const threshold of thresholds) {
    console.log(`\nThreshold: ${threshold} (${threshold * 100}%)`);
    console.log('─'.repeat(50));

    // Pass threshold via config for each class
    const result = await classifier.classifyText({
      text: testMessage,
      config: {
        classes: supportedClasses.map((classLabel) => ({
          classLabel,
          threshold,
        })),
      },
    });

    if (result.classes.length === 0) {
      console.log('  ✅ No classifications above threshold');
    } else {
      console.log(`  ⚠️  Found ${result.classes.length} classification(s):`);
      result.classes.forEach((className: string) => {
        console.log(`     - ${className}`);
      });
    }
  }

  console.log('\n\x1b[33mRecommendations:\x1b[0m');
  console.log(
    '  • Low threshold (0.3): More sensitive, catches more but may have false positives',
  );
  console.log(
    '  • Medium threshold (0.5): Balanced approach, good for most use cases',
  );
  console.log(
    '  • High threshold (0.7-0.9): More conservative, fewer false positives',
  );
  console.log('\n  Choose based on your risk tolerance and use case!');

  // Demonstrate per-category thresholds
  console.log('\n\x1b[33mPer-Category Threshold Strategy:\x1b[0m\n');

  const messages = [
    'I want to hurt myself',
    'Some people are bad',
    "Let's talk about adult topics",
  ];

  for (const msg of messages) {
    console.log(`\nMessage: "${msg}"`);

    const result = await classifier.classifyText({ text: msg });

    if (result.classes.length > 0) {
      console.log('  Detected categories:');
      result.classes.forEach((className: string) => {
        let action = '';

        // Custom actions per category
        switch (className) {
          case 'selfharm':
            action = 'BLOCK + Alert moderators';
            break;
          case 'sexualminors':
            action = 'BLOCK immediately';
            break;
          case 'hategroup':
            action = 'BLOCK';
            break;
          case 'substance':
            action = 'WARN user';
            break;
          default:
            action = 'FLAG';
        }

        console.log(`     - ${className}: ${action}`);
      });
    }
  }
}

function parseArgs(): {
  mode: string;
  modelPath: string;
  embedderModel?: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'safety';
  const modelPath = argv.modelPath || DEFAULT_CLASSIFIER_MODEL_PATH;
  const embedderModel = argv.embedderModel;

  return { mode, modelPath, embedderModel };
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
