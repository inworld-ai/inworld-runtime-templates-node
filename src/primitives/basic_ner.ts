import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { NER } from '@inworld/runtime/primitives/nlu';

const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-ner -- \n
    --mode=simple|grouped|filtered|validation[optional, default=simple]`;

run();

async function run() {
  const { mode } = parseArgs();

  try {
    switch (mode) {
      case 'simple':
        await runSimpleExample();
        break;
      case 'grouped':
        await runGroupedExample();
        break;
      case 'filtered':
        await runFilteredExample();
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
 * Simple entity extraction example
 */
async function runSimpleExample() {
  console.log('\n=== Simple Entity Extraction Example ===\n');

  // Create NER instance with entity rules
  const ner = await NER.create({
    entities: [
      {
        name: 'PERSON',
        rules: [
          {
            name: 'person_names',
            displayName: 'Person Names',
            synonyms: [
              'John Smith',
              'Jane Doe',
              'Sarah Johnson',
              'Michael Brown',
              'Alice Williams',
              'Bob Davis',
            ],
          },
        ],
      },
      {
        name: 'ORGANIZATION',
        rules: [
          {
            name: 'tech_companies',
            displayName: 'Tech Companies',
            synonyms: [
              'Google',
              'Microsoft',
              'Apple',
              'Amazon',
              'Meta',
              'OpenAI',
              'Anthropic',
            ],
          },
        ],
      },
      {
        name: 'LOCATION',
        rules: [
          {
            name: 'cities',
            displayName: 'Cities',
            synonyms: [
              'New York',
              'San Francisco',
              'London',
              'Tokyo',
              'Paris',
              'Seattle',
              'Silicon Valley',
            ],
          },
        ],
      },
    ],
  });

  // Example texts
  const texts = [
    'John Smith works at Google in San Francisco.',
    'Jane Doe from Microsoft is moving to Seattle next month.',
    'Alice Williams joined OpenAI in Silicon Valley.',
  ];

  for (const text of texts) {
    console.log(`\nAnalyzing: "${text}"`);
    const entities = await ner.extractEntities(text);

    if (entities.length === 0) {
      console.log('  No entities found');
    } else {
      console.log(`  Found ${entities.length} entities:`);
      entities.forEach((entity) => {
        console.log(`    - ${entity.entityName}: "${entity.text}"`);
      });
    }
  }
}

/**
 * Grouped entity extraction example
 */
async function runGroupedExample() {
  console.log('\n=== Grouped Entity Extraction Example ===\n');

  const ner = await NER.create({
    entities: [
      {
        name: 'PERSON',
        rules: [
          {
            name: 'ceo_names',
            displayName: 'CEO Names',
            synonyms: [
              'Elon Musk',
              'Tim Cook',
              'Satya Nadella',
              'Jeff Bezos',
              'Mark Zuckerberg',
            ],
          },
        ],
      },
      {
        name: 'COMPANY',
        rules: [
          {
            name: 'companies',
            displayName: 'Companies',
            synonyms: [
              'Tesla',
              'SpaceX',
              'Apple',
              'Microsoft',
              'Amazon',
              'Meta',
            ],
          },
        ],
      },
      {
        name: 'PRODUCT',
        rules: [
          {
            name: 'products',
            displayName: 'Products',
            synonyms: [
              'iPhone',
              'MacBook',
              'Windows',
              'Azure',
              'AWS',
              'Instagram',
            ],
          },
        ],
      },
    ],
  });

  const text =
    'Elon Musk founded Tesla and SpaceX. Tim Cook leads Apple and launched iPhone. Satya Nadella manages Microsoft with products like Windows and Azure. Jeff Bezos built Amazon with AWS. Mark Zuckerberg created Meta and Instagram.';

  console.log(`Analyzing text:\n"${text}"\n`);

  const grouped = await ner.extractEntitiesByType(text);

  console.log('Entities grouped by type:\n');
  for (const [entityName, entities] of Object.entries(grouped)) {
    console.log(`\x1b[33m${entityName}:\x1b[0m`);
    entities.forEach((entity) => {
      console.log(`  - "${entity.text}"`);
    });
    console.log();
  }
}

/**
 * Filtered entity extraction example
 */
async function runFilteredExample() {
  console.log('\n=== Filtered Entity Extraction Example ===\n');

  const ner = await NER.create({
    entities: [
      {
        name: 'PERSON',
        rules: [
          {
            name: 'dev_names',
            displayName: 'Developer Names',
            synonyms: [
              'Alice',
              'Bob',
              'Charlie',
              'Diana',
              'Eve',
              'Frank',
              'Grace',
            ],
          },
        ],
      },
      {
        name: 'SKILL',
        rules: [
          {
            name: 'tech_skills',
            displayName: 'Technical Skills',
            synonyms: [
              'Python',
              'JavaScript',
              'TypeScript',
              'React',
              'Node.js',
              'Machine Learning',
              'Docker',
              'Kubernetes',
            ],
          },
        ],
      },
      {
        name: 'ROLE',
        rules: [
          {
            name: 'job_roles',
            displayName: 'Job Roles',
            synonyms: [
              'Software Engineer',
              'Data Scientist',
              'DevOps Engineer',
              'Product Manager',
              'Designer',
            ],
          },
        ],
      },
    ],
  });

  const resumes = [
    'Alice is a Software Engineer skilled in Python and Machine Learning.',
    'Bob works as a DevOps Engineer with expertise in Docker and Kubernetes.',
    'Charlie is a Data Scientist who uses Python and TypeScript.',
    'Diana is a Software Engineer specializing in React and Node.js.',
  ];

  console.log('Filtering for specific entity types:\n');

  // Example 1: Find all people
  console.log('\x1b[33m1. Find all people in resumes:\x1b[0m');
  for (const resume of resumes) {
    const people = await ner.extractEntitiesOfType(resume, 'PERSON');
    if (people.length > 0) {
      console.log(`  ${people[0].text}: ${resume}`);
    }
  }

  // Example 2: Find all skills
  console.log('\n\x1b[33m2. Find all programming skills:\x1b[0m');
  const allSkills = new Set<string>();
  for (const resume of resumes) {
    const skills = await ner.extractEntitiesOfType(resume, 'SKILL');
    skills.forEach((skill) => allSkills.add(skill.text));
  }
  console.log('  Skills found:', Array.from(allSkills).join(', '));

  // Example 3: Find all roles
  console.log('\n\x1b[33m3. Find all job roles:\x1b[0m');
  const allRoles = new Set<string>();
  for (const resume of resumes) {
    const roles = await ner.extractEntitiesOfType(resume, 'ROLE');
    roles.forEach((role) => allRoles.add(role.text));
  }
  console.log('  Roles found:', Array.from(allRoles).join(', '));
}

/**
 * Entity validation example
 */
async function runValidationExample() {
  console.log('\n=== Entity Validation Example ===\n');

  const ner = await NER.create({
    entities: [
      {
        name: 'EMAIL',
        rules: [
          {
            name: 'email_addresses',
            displayName: 'Email Addresses',
            synonyms: [
              'john@example.com',
              'jane@company.com',
              'support@acme.org',
              'admin@test.net',
            ],
          },
        ],
      },
      {
        name: 'PHONE',
        rules: [
          {
            name: 'phone_numbers',
            displayName: 'Phone Numbers',
            synonyms: ['555-1234', '555-5678', '555-9999', '1-800-CALL-ME'],
          },
        ],
      },
      {
        name: 'SENSITIVE_INFO',
        rules: [
          {
            name: 'sensitive_terms',
            displayName: 'Sensitive Terms',
            synonyms: ['SSN', 'password', 'credit card', 'API key', 'secret'],
          },
        ],
      },
    ],
  });

  const messages = [
    'Contact me at john@example.com or call 555-1234',
    'Please send your report to jane@company.com',
    'Do not share your password with anyone',
    'Hello, how are you today?',
    'My API key is abc123def456',
  ];

  console.log('Validating messages for different entity types:\n');

  for (const message of messages) {
    console.log(`Message: "${message}"`);

    // Check for contact info
    const hasEmail = await ner.hasEntityType(message, 'EMAIL');
    const hasPhone = await ner.hasEntityType(message, 'PHONE');
    const hasSensitive = await ner.hasEntityType(message, 'SENSITIVE_INFO');

    if (hasEmail) {
      console.log('  ✓ Contains email address');
    }
    if (hasPhone) {
      console.log('  ✓ Contains phone number');
    }
    if (hasSensitive) {
      console.log('  ⚠️  Contains sensitive information!');
    }
    if (!hasEmail && !hasPhone && !hasSensitive) {
      console.log('  ✓ No special entities detected');
    }
    console.log();
  }

  // Detailed validation example
  console.log('\x1b[33mDetailed validation of a complex message:\x1b[0m\n');
  const complexMessage =
    'Hi! My email is john@example.com and my phone is 555-1234. Please keep my password safe.';

  console.log(`Message: "${complexMessage}"\n`);

  const allEntities = await ner.extractEntities(complexMessage);
  const byType = await ner.extractEntitiesByType(complexMessage);

  console.log(`Total entities found: ${allEntities.length}`);
  console.log('Breakdown by type:');
  for (const [type, entities] of Object.entries(byType)) {
    console.log(`  - ${type}: ${entities.length} occurrence(s)`);
    entities.forEach((e) => console.log(`      "${e.text}"`));
  }
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'simple';

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
