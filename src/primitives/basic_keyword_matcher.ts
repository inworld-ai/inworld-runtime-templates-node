import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { KeywordMatcher } from '@inworld/runtime/primitives/nlu';

const minimist = require('minimist');

const usage = `
Usage:
    yarn basic-keyword-matcher \n
    --mode=intent|safety|commands|validation[optional, default=intent]`;

run();

async function run() {
  const { mode } = parseArgs();

  try {
    switch (mode) {
      case 'intent':
        await runIntentMatchingExample();
        break;
      case 'safety':
        await runSafetyFilteringExample();
        break;
      case 'commands':
        await runCommandRecognitionExample();
        break;
      case 'validation':
        await runValidationExample();
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
 * Intent matching example - Detect user intents based on keywords
 */
async function runIntentMatchingExample() {
  console.log('\n=== Intent Matching Example ===\n');

  // Create keyword matcher for common user intents
  const matcher = await KeywordMatcher.create([
    {
      name: 'order_intent',
      keywords: ['buy', 'purchase', 'order', 'get', 'want', 'need'],
    },
    {
      name: 'cancel_intent',
      keywords: ['cancel', 'refund', 'return', 'remove'],
    },
    {
      name: 'help_intent',
      keywords: ['help', 'support', 'assistance', 'question', 'how'],
    },
    {
      name: 'greeting_intent',
      keywords: [
        'hello',
        'hi',
        'hey',
        'greetings',
        'good morning',
        'good afternoon',
      ],
    },
    {
      name: 'farewell_intent',
      keywords: ['goodbye', 'bye', 'see you', 'farewell', 'later'],
    },
  ]);

  const userMessages = [
    'Hello! I need help with my order',
    'I want to buy a new laptop',
    'How can I cancel my subscription?',
    'Thanks for your help! Goodbye!',
    'Can you help me purchase the premium plan?',
  ];

  for (const message of userMessages) {
    console.log(`\nUser message: "${message}"`);
    const result = await matcher.matchKeywords(message);

    if (result.matches.length === 0) {
      console.log('  No intent detected');
    } else {
      console.log(`  Detected ${result.matches.length} keyword match(es):`);
      // Group matches by intent
      const intentMap = new Map<string, string[]>();
      result.matches.forEach((match) => {
        const groupKey = match.groupName || 'unknown';
        if (!intentMap.has(groupKey)) {
          intentMap.set(groupKey, []);
        }
        intentMap.get(groupKey)!.push(match.keyword);
      });

      intentMap.forEach((keywords, intent) => {
        if (intent !== 'unknown') {
          console.log(`    - ${intent}: [${keywords.join(', ')}]`);
        } else {
          console.log(`    - Keywords: [${keywords.join(', ')}]`);
        }
      });
    }
  }
}

/**
 * Safety filtering example - Detect unsafe content
 */
async function runSafetyFilteringExample() {
  console.log('\n=== Safety Filtering Example ===\n');

  const matcher = await KeywordMatcher.create([
    {
      name: 'profanity',
      keywords: ['damn', 'hell', 'crap', 'stupid'],
    },
    {
      name: 'violence',
      keywords: ['kill', 'hurt', 'attack', 'fight', 'punch'],
    },
    {
      name: 'spam',
      keywords: [
        'click here',
        'buy now',
        'limited offer',
        'act now',
        'free money',
      ],
    },
  ]);

  const messages = [
    'This is a great product! I love it.',
    'This is so damn stupid!',
    'Click here for free money! Limited offer!',
    'I want to hurt someone right now',
    'Hello, how are you today?',
  ];

  console.log('Content safety check:\n');

  for (const message of messages) {
    console.log(`Message: "${message}"`);
    const result = await matcher.matchKeywords(message);

    if (result.matches.length === 0) {
      console.log('  ✅ SAFE - No safety issues detected');
    } else {
      console.log(
        `  ⚠️  UNSAFE - Found ${result.matches.length} safety violation(s):`,
      );
      result.matches.forEach((match) => {
        const category = match.groupName || 'safety';
        console.log(`      - "${match.keyword}" (category: ${category})`);
      });
    }
    console.log();
  }
}

/**
 * Command recognition example - Detect voice/text commands
 */
async function runCommandRecognitionExample() {
  console.log('\n=== Command Recognition Example ===\n');

  const matcher = await KeywordMatcher.create([
    {
      name: 'navigation',
      keywords: ['go to', 'navigate', 'open', 'show me', 'take me to'],
    },
    {
      name: 'action',
      keywords: ['start', 'stop', 'pause', 'resume', 'play', 'record'],
    },
    {
      name: 'query',
      keywords: [
        'what is',
        'who is',
        'when is',
        'where is',
        'how to',
        'tell me',
      ],
    },
    {
      name: 'settings',
      keywords: ['set', 'change', 'configure', 'adjust', 'update'],
    },
  ]);

  const commands = [
    'Open the settings menu',
    'Start recording my voice',
    'What is the weather today?',
    'Change the volume to 50%',
    'Navigate to the home page',
    'Tell me how to reset my password',
  ];

  console.log('Recognizing commands:\n');

  for (const command of commands) {
    console.log(`Command: "${command}"`);
    const result = await matcher.matchKeywords(command);

    if (result.matches.length === 0) {
      console.log('  ❌ Command not recognized');
    } else {
      const commandTypes = [
        ...new Set(result.matches.map((m) => m.groupName || 'command')),
      ];
      const keywords = result.matches.map((m) => m.keyword);
      const typesList = commandTypes.filter((t) => t && t !== 'command');
      const typesStr = typesList.length > 0 ? typesList.join(', ') : 'command';
      console.log(`  ✓ Recognized as: ${typesStr}`);
      console.log(`    Triggers: [${keywords.join(', ')}]`);
    }
    console.log();
  }
}

/**
 * Validation example - Check for specific keyword groups
 */
async function runValidationExample() {
  console.log('\n=== Keyword Validation Example ===\n');

  const matcher = await KeywordMatcher.create([
    {
      name: 'technical_terms',
      keywords: [
        'API',
        'database',
        'server',
        'endpoint',
        'authentication',
        'deployment',
        'microservice',
      ],
    },
    {
      name: 'programming_languages',
      keywords: [
        'JavaScript',
        'TypeScript',
        'Python',
        'Java',
        'Go',
        'Rust',
        'C++',
      ],
    },
    {
      name: 'frameworks',
      keywords: [
        'React',
        'Angular',
        'Vue',
        'Node.js',
        'Express',
        'Django',
        'Flask',
      ],
    },
  ]);

  const jobDescriptions = [
    'Looking for a developer with JavaScript and React experience',
    'Need someone who knows Python and Django for backend work',
    'API development experience required with microservice architecture',
    'Great communication skills and team player needed',
    'Expert in TypeScript, Node.js, and database design',
  ];

  console.log('Analyzing job descriptions for technical content:\n');

  for (const description of jobDescriptions) {
    console.log(`Description: "${description}"`);

    // Check if description contains technical terms
    const hasTechnical = await matcher.hasKeywordsFromGroups(description, [
      'technical_terms',
    ]);
    const hasLanguages = await matcher.hasKeywordsFromGroups(description, [
      'programming_languages',
    ]);
    const hasFrameworks = await matcher.hasKeywordsFromGroups(description, [
      'frameworks',
    ]);

    // Get all matches
    const result = await matcher.matchKeywords(description);

    if (result.matches.length === 0) {
      console.log('  ⚠️  No technical keywords found');
    } else {
      console.log('  Technical content detected:');
      // Note: groupName may be undefined due to a known issue in the addon
      // In production, you would group by actual groupName values
      const allKeywords = result.matches.map((m) => m.keyword);
      console.log(
        `    ✓ Technical keywords found: [${allKeywords.join(', ')}]`,
      );

      if (hasTechnical) {
        console.log(`    ✓ Contains technical terms`);
      }
      if (hasLanguages) {
        console.log(`    ✓ Contains programming languages`);
      }
      if (hasFrameworks) {
        console.log(`    ✓ Contains frameworks`);
      }
    }
    console.log();
  }

  // Demonstrate getMatchesForGroups
  console.log('\x1b[33mDetailed analysis of a complex description:\x1b[0m\n');
  const complexDesc =
    'Senior TypeScript developer needed. Must have experience with Node.js, React, and API development. Database and microservice knowledge required.';

  console.log(`Description: "${complexDesc}"\n`);

  const techMatches = await matcher.getMatchesForGroups(complexDesc, [
    'technical_terms',
  ]);
  const langMatches = await matcher.getMatchesForGroups(complexDesc, [
    'programming_languages',
  ]);
  const fwkMatches = await matcher.getMatchesForGroups(complexDesc, [
    'frameworks',
  ]);

  console.log('Breakdown by category:');
  console.log(`  Technical terms: ${techMatches.length} found`);
  techMatches.forEach((m) => console.log(`    - ${m.keyword}`));

  console.log(`  Programming languages: ${langMatches.length} found`);
  langMatches.forEach((m) => console.log(`    - ${m.keyword}`));

  console.log(`  Frameworks: ${fwkMatches.length} found`);
  fwkMatches.forEach((m) => console.log(`    - ${m.keyword}`));
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'intent';

  return { mode };
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
