import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { Knowledge } from '@inworld/runtime/primitives/knowledge';
import { FileType } from '@inworld/runtime/primitives/knowledge';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-knowledge -- \n
    --mode=basic|file|multisource|batch[optional, default=basic]`;

run();

async function run() {
  const { mode } = parseArgs();

  try {
    switch (mode) {
      case 'basic':
        await runBasicRAGExample();
        break;
      case 'file':
        await runFileBasedKnowledgeExample();
        break;
      case 'multisource':
        await runMultiSourceKnowledgeExample();
        break;
      case 'batch':
        await runBatchOperationsExample();
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
 * Basic RAG (Retrieval-Augmented Generation) example
 * Demonstrates compiling knowledge from text and retrieving it
 */
async function runBasicRAGExample() {
  console.log('\n=== Basic RAG Example ===\n');

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable is required');
  }

  // Create Knowledge instance with remote config
  console.log('Creating Knowledge instance...');
  const knowledge = await Knowledge.create({
    knowledgeCompileConfig: {},
    apiKey,
    language: { code: 'en' },
    defaultTimeout: '30s',
  });

  console.log('Knowledge instance created!\n');

  // Define knowledge base about programming
  const knowledgeId = `knowledge/${uuidv4()}`;
  const programmingRecords = [
    'JavaScript is a high-level, interpreted programming language. It is one of the core technologies of the World Wide Web.',
    'Python is known for its simple syntax and readability. It is widely used in data science, machine learning, and web development.',
    'TypeScript is a superset of JavaScript that adds static typing. It helps catch errors during development.',
    'Node.js is a JavaScript runtime built on Chrome V8 engine. It allows JavaScript to run on the server side.',
    'React is a JavaScript library for building user interfaces. It uses a component-based architecture.',
  ];

  // Compile knowledge
  console.log(`Compiling ${programmingRecords.length} knowledge records...`);
  console.log(`Knowledge ID: ${knowledgeId}`);
  const compiled = await knowledge.compileKnowledge({
    knowledgeId,
    input: { records: programmingRecords },
  });

  console.log(`✅ Compiled ${compiled.records?.length || 0} records\n`);

  // Query the knowledge base
  const queries = [
    'What is TypeScript?',
    'Tell me about Python',
    'What can JavaScript do?',
    'How does React work?',
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log('─'.repeat(60));

    const results = await knowledge.search([knowledgeId], query, {
      threshold: 0.5,
      topK: 2,
    });

    if (results.records && results.records.length > 0) {
      console.log(`Found ${results.records.length} relevant record(s):`);
      results.records.forEach((record, index) => {
        console.log(`\n  [${index + 1}] ${record}`);
      });
    } else {
      console.log('No relevant records found');
    }
  }

  // Cleanup
  console.log('\n\nCleaning up...');
  await knowledge.removeKnowledge(knowledgeId);
  console.log('✅ Knowledge removed');
}

/**
 * File-based knowledge example
 * Demonstrates loading knowledge from files
 */
async function runFileBasedKnowledgeExample() {
  console.log('\n=== File-Based Knowledge Example ===\n');

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable is required');
  }

  const knowledge = await Knowledge.create({
    knowledgeCompileConfig: {},
    apiKey,
    language: { code: 'en' },
    defaultTimeout: '30s',
  });

  // Create temporary knowledge files
  const tempDir = path.join(__dirname, '../data-output/temp_knowledge');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const aiTopicsFile = path.join(tempDir, 'ai_topics.txt');
  const aiTopicsContent = `
Artificial Intelligence (AI) is the simulation of human intelligence by machines.
Machine Learning is a subset of AI that enables systems to learn from data.
Deep Learning uses neural networks with multiple layers to process complex patterns.
Natural Language Processing (NLP) helps computers understand human language.
Computer Vision enables machines to interpret visual information from the world.
  `.trim();

  fs.writeFileSync(aiTopicsFile, aiTopicsContent);

  try {
    const knowledgeId = `knowledge/${uuidv4()}`;

    // Compile knowledge from file
    console.log('Compiling knowledge from file...');
    const fileContent = fs.readFileSync(aiTopicsFile);
    const compiled = await knowledge.compileKnowledgeFromFile({
      knowledgeId,
      input: { content: fileContent, type: FileType.TXT },
    });

    console.log(
      `✅ Compiled ${compiled.records?.length || 0} records from file\n`,
    );

    // Query the knowledge
    const queries = [
      'What is Machine Learning?',
      'Explain Deep Learning',
      'What is NLP?',
    ];

    for (const query of queries) {
      console.log(`Query: "${query}"`);
      const results = await knowledge.search([knowledgeId], query, {
        threshold: 0.5,
        topK: 2,
      });

      if (results.records && results.records.length > 0) {
        results.records.forEach((record) => {
          console.log(`  ➜ ${record}`);
        });
      }
      console.log();
    }

    // Cleanup
    await knowledge.removeKnowledge(knowledgeId);
    console.log('✅ Knowledge removed');
  } finally {
    // Clean up temp files
    if (fs.existsSync(aiTopicsFile)) {
      fs.unlinkSync(aiTopicsFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  }
}

/**
 * Multi-source knowledge example
 * Demonstrates working with multiple knowledge bases
 */
async function runMultiSourceKnowledgeExample() {
  console.log('\n=== Multi-Source Knowledge Example ===\n');

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable is required');
  }

  const knowledge = await Knowledge.create({
    knowledgeCompileConfig: {},
    apiKey,
    language: { code: 'en' },
    defaultTimeout: '30s',
  });

  // Create multiple knowledge bases for different topics
  const knowledgeBases = [
    {
      id: `knowledge/${uuidv4()}`,
      records: [
        'React is a JavaScript library for building UIs',
        'Vue.js is a progressive JavaScript framework',
        'Angular is a platform for building web applications',
      ],
    },
    {
      id: `knowledge/${uuidv4()}`,
      records: [
        'Express is a minimal Node.js web framework',
        'Django is a Python web framework for rapid development',
        'Spring Boot simplifies Java application development',
      ],
    },
    {
      id: `knowledge/${uuidv4()}`,
      records: [
        'PostgreSQL is a powerful open-source relational database',
        'MongoDB is a document-oriented NoSQL database',
        'Redis is an in-memory data structure store',
      ],
    },
  ];

  // Compile all knowledge bases
  console.log('Compiling multiple knowledge bases...');
  for (const kb of knowledgeBases) {
    const compiled = await knowledge.compileKnowledge({
      knowledgeId: kb.id,
      input: { records: kb.records },
    });
    console.log(
      `  ✅ Compiled ${kb.id}: ${compiled.records?.length || 0} records`,
    );
  }
  console.log();

  // Search across specific knowledge bases
  const searchScenarios = [
    {
      query: 'What frontend frameworks are available?',
      sources: ['knowledge/frontend'],
    },
    {
      query: 'Tell me about backend frameworks',
      sources: ['knowledge/backend'],
    },
    {
      query: 'What database should I use?',
      sources: ['knowledge/databases'],
    },
    {
      query: 'What technologies for full-stack development?',
      sources: ['knowledge/frontend', 'knowledge/backend'],
    },
  ];

  for (const scenario of searchScenarios) {
    console.log(`\nQuery: "${scenario.query}"`);
    console.log(`Sources: [${scenario.sources.join(', ')}]`);
    console.log('─'.repeat(60));

    const results = await knowledge.search(scenario.sources, scenario.query, {
      threshold: 0.5,
      topK: 3,
    });

    if (results.records && results.records.length > 0) {
      results.records.forEach((record, index) => {
        console.log(`  [${index + 1}] ${record}`);
      });
    }
  }

  // Retrieve by ID without search
  console.log('\n\nRetrieving all records from frontend knowledge base:');
  const frontendRecords = await knowledge.getKnowledge({
    ids: ['knowledge/frontend'],
    searchQuery: '',
  });

  if (frontendRecords.records) {
    frontendRecords.records.forEach((record, index) => {
      console.log(`  [${index + 1}] ${record}`);
    });
  }

  // Cleanup all knowledge bases
  console.log('\n\nCleaning up all knowledge bases...');
  for (const kb of knowledgeBases) {
    await knowledge.removeKnowledge(kb.id);
  }
  console.log('✅ All knowledge bases removed');
}

/**
 * Batch operations example
 * Demonstrates efficient batch compilation and removal
 */
async function runBatchOperationsExample() {
  console.log('\n=== Batch Operations Example ===\n');

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    throw new Error('INWORLD_API_KEY environment variable is required');
  }

  const knowledge = await Knowledge.create({
    knowledgeCompileConfig: {},
    apiKey,
    language: { code: 'en' },
    defaultTimeout: '30s',
  });

  // Prepare multiple knowledge sets
  const knowledgeSets = [
    {
      knowledgeId: `knowledge/${uuidv4()}`,
      input: {
        records: [
          'Docker containers package applications with dependencies',
          'Kubernetes orchestrates containerized applications',
        ],
      },
    },
    {
      knowledgeId: `knowledge/${uuidv4()}`,
      input: {
        records: [
          'Git is a distributed version control system',
          'GitHub is a platform for hosting Git repositories',
        ],
      },
    },
    {
      knowledgeId: `knowledge/${uuidv4()}`,
      input: {
        records: [
          'REST is an architectural style for web services',
          'GraphQL is a query language for APIs',
        ],
      },
    },
  ];

  // Batch compile
  console.log(`Batch compiling ${knowledgeSets.length} knowledge sets...`);
  const startTime = Date.now();

  const results = await knowledge.compileBatch(knowledgeSets);

  const duration = Date.now() - startTime;
  console.log(`✅ Compiled ${results.length} knowledge sets in ${duration}ms`);

  results.forEach((result, index) => {
    const recordCount = result.records?.length || 0;
    console.log(`  - Set ${index + 1}: ${recordCount} records`);
  });

  // Search across all compiled knowledge
  console.log('\n\nSearching across all knowledge sets:');
  const allIds = knowledgeSets.map((ks) => ks.knowledgeId);

  const queries = [
    'How to deploy applications?',
    'What is version control?',
    'API design patterns',
  ];

  for (const query of queries) {
    console.log(`\n  Query: "${query}"`);
    const searchResults = await knowledge.search(allIds, query, {
      threshold: 0.5,
      topK: 2,
    });

    if (searchResults.records && searchResults.records.length > 0) {
      searchResults.records.forEach((record) => {
        console.log(`    ➜ ${record}`);
      });
    }
  }

  // Batch remove
  console.log('\n\nBatch removing all knowledge sets...');
  await knowledge.removeBatch(allIds);
  console.log('✅ All knowledge sets removed');

  // Verify removal
  console.log('\nVerifying removal...');
  try {
    await knowledge.getKnowledge({ ids: [allIds[0]], searchQuery: '' });
    console.log('⚠️  Warning: Knowledge still exists');
  } catch (_error) {
    console.log('✅ Confirmed: Knowledge successfully removed');
  }

  // Performance comparison
  console.log('\n\x1b[33mPerformance Tips:\x1b[0m');
  console.log('  • Use compileBatch() for multiple knowledge sets');
  console.log('  • Use removeBatch() for cleanup of multiple sets');
  console.log(
    '  • Search across multiple IDs in one call for better performance',
  );
  console.log('  • Use topK parameter to limit results and improve speed');
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'basic';

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
