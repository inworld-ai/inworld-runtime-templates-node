import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { GraphBuilder, KeywordMatcherNode } from '@inworld/runtime/graph';
import * as fs from 'fs';
import path from 'path';

const minimist = require('minimist');

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
    yarn node-keyword-matcher "Your text to check" \\
    --profanityPath=<profanity-path>[optional, path to profanity.json] \\
    --adultPath=<adult-path>[optional, path to adult.json] \\
    --substancePath=<substance-path>[optional, path to substance_use.json]

Examples:
    # Test safe content
    yarn node-keyword-matcher "I love pizza and learning"

    # Test unsafe content (profanity)
    yarn node-keyword-matcher "This is fucking stupid"

    # Test with custom keyword files
    yarn node-keyword-matcher "Let's do drugs" \\
      --profanityPath="graph/fixtures/profanity.json" \\
      --adultPath="graph/fixtures/adult.json" \\
      --substancePath="graph/fixtures/substance_use.json"
`;

run();

async function run() {
  const { text, profanityPath, adultPath, substancePath, apiKey } = parseArgs();

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

  // Create keyword matcher node
  const keywordMatcherNode = new KeywordMatcherNode({
    id: 'keyword_matcher_node',
    keywords: keywordGroups,
    reportToClient: true,
  });

  // Build simple graph with just keyword matcher
  const graph = new GraphBuilder({
    id: 'keyword_matcher_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(keywordMatcherNode)
    .setStartNode(keywordMatcherNode)
    .setEndNode(keywordMatcherNode)
    .build();

  try {
    const { outputStream } = await graph.start(text);

    for await (const result of outputStream) {
      await result.processResponse({
        MatchedKeywords: (matchedKeywords: any) => {
          console.log('\n=== Keyword Matcher Result ===');

          if (matchedKeywords.keywords && matchedKeywords.keywords.length > 0) {
            console.log(
              `UNSAFE: Found ${matchedKeywords.keywords.length} keyword matches:`,
            );
            matchedKeywords.keywords.forEach(
              (keywordMatch: any, index: number) => {
                console.log(
                  `  ${index + 1}. "${keywordMatch.keyword}" (group: ${keywordMatch.groupName})`,
                );
              },
            );
          } else {
            console.log('SAFE: No keyword matches found');
          }

          console.log(`Input Text: "${text}"`);
          console.log(`Result Type: MatchedKeywords`);
        },
        default: (data: any) => {
          console.log('\n=== Unhandled Result ===');
          console.log('Debug data:', data);
        },
      });
    }
  } catch (error: any) {
    console.error('\nKeyword matcher failed:', error.message);
  }
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
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
  const profanityPath =
    argv.profanityPath || DEFAULT_KEYWORD_MATCHER_PROFANITY_CONFIG_PATH;
  const adultPath = argv.adultPath || DEFAULT_KEYWORD_MATCHER_ADULT_CONFIG_PATH;
  const substancePath =
    argv.substancePath || DEFAULT_KEYWORD_MATCHER_SUBSTANCE_USE_CONFIG_PATH;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(
      `You need to provide text to check for keywords.\n${usage}`,
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
    profanityPath,
    adultPath,
    substancePath,
    apiKey,
  };
}
