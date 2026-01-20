import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { PromptBuilder } from '@inworld/runtime/primitives/llm';
import { readFileSync } from 'fs';
import * as path from 'path';

const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-prompt-builder -- \n
    --mode=simple|file|complex|validation[optional, default=simple] \n
    --template=<path-to-template-file>[optional, for file mode] \n
    --variables=<path-to-variables-file>[optional, for file mode]`;

run();

async function run() {
  const { mode, template, variables } = parseArgs();

  try {
    switch (mode) {
      case 'simple':
        await runSimpleExample();
        break;
      case 'file':
        await runFileExample(template, variables);
        break;
      case 'complex':
        await runComplexExamples();
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
 * Simple greeting template example
 */
async function runSimpleExample() {
  console.log('\n\x1b[36m=== Simple Greeting Example ===\x1b[0m\n');

  // Create a simple greeting template
  const template = 'Hello {{ name }}! Welcome to {{ place }}.';
  const builder = await PromptBuilder.create(template);

  // Build prompt with different variables
  const prompt1 = await builder.build({
    name: 'Alice',
    place: 'Wonderland',
  });
  console.log('Prompt 1:', prompt1);

  const prompt2 = await builder.build({
    name: 'Bob',
    place: 'the Matrix',
  });
  console.log('Prompt 2:', prompt2);

  // Also works with JSON string
  const prompt3 = await builder.build('{"name": "Charlie", "place": "Narnia"}');
  console.log('Prompt 3:', prompt3);
}

/**
 * Load template and variables from files
 */
async function runFileExample(templatePath: string, variablesPath: string) {
  console.log('\n\x1b[36m=== File-based Template Example ===\x1b[0m\n');

  // Load template from file
  const template = readFileSync(templatePath, 'utf8');
  console.log('Template loaded from:', templatePath);

  // Load variables from file
  const variablesJson = readFileSync(variablesPath, 'utf8');
  const variables = JSON.parse(variablesJson);
  console.log('Variables loaded from:', variablesPath);

  // Create builder and render
  const builder = await PromptBuilder.create(template);
  const prompt = await builder.build(variables);

  console.log('\n\x1b[45m Rendered Prompt: \x1b[0m\n');
  console.log(prompt);
}

/**
 * Complex examples with conditions, loops, and filters
 */
async function runComplexExamples() {
  console.log('\n\x1b[36m=== Complex Template Examples ===\x1b[0m\n');

  // Example 1: Conditional template
  console.log('\x1b[33m1. Conditional Template:\x1b[0m');
  const conditionalTemplate = `
{% if user_type == 'premium' %}
Welcome back, premium member {{ name }}!
You have access to all features.
{% else %}
Welcome {{ name }}!
Consider upgrading to premium for more features.
{% endif %}`;

  const conditionalBuilder = await PromptBuilder.create(conditionalTemplate);

  const premiumPrompt = await conditionalBuilder.build({
    name: 'Alice',
    user_type: 'premium',
  });
  console.log(premiumPrompt);

  const regularPrompt = await conditionalBuilder.build({
    name: 'Bob',
    user_type: 'regular',
  });
  console.log(regularPrompt);

  // Example 2: Loop template
  console.log('\n\x1b[33m2. Loop Template:\x1b[0m');
  const loopTemplate =
    `
Shopping Cart for {{ customer_name }}:
{% for item in items %}
- {{ item.name }}: ` +
    '${{ item.price }}' +
    ` x {{ item.quantity }}
{% endfor %}
Total: ` +
    '${{ total }}';

  const loopBuilder = await PromptBuilder.create(loopTemplate);

  const cartPrompt = await loopBuilder.build({
    customer_name: 'Charlie',
    items: [
      { name: 'Apple', price: 1.5, quantity: 3 },
      { name: 'Banana', price: 0.8, quantity: 5 },
      { name: 'Orange', price: 2.0, quantity: 2 },
    ],
    total: 12.5,
  });
  console.log(cartPrompt);

  // Example 3: LLM Character Prompt
  console.log('\n\x1b[33m3. AI Character Prompt:\x1b[0m');
  const characterTemplate = `
You are {{ character.name }}, {{ character.description }}.

Personality Traits:
{% for trait in character.traits %}
- {{ trait }}
{% endfor %}

Current Situation:
{{ situation }}

{% if knowledge %}
You also know:
{% for fact in knowledge %}
- {{ fact }}
{% endfor %}
{% endif %}

User: {{ user_message }}
{{ character.name }}:`;

  const characterBuilder = await PromptBuilder.create(characterTemplate);

  const characterPrompt = await characterBuilder.build({
    character: {
      name: 'RoboAssistant',
      description: 'a helpful AI assistant specialized in coding',
      traits: ['Patient', 'Detailed', 'Enthusiastic about technology'],
    },
    situation: 'Helping a developer debug their code',
    knowledge: [
      'TypeScript is a superset of JavaScript',
      'async/await makes asynchronous code easier to read',
    ],
    user_message: 'Can you explain how async/await works?',
  });
  console.log(characterPrompt);

  // Example 4: Filters and formatting
  console.log('\n\x1b[33m4. Template with Filters:\x1b[0m');
  const filterTemplate = `
Report for {{ company_name | upper }}
Date: {{ date }}
Status: {{ status | capitalize }}

{% if errors %}
Errors Found:
{% for error in errors %}
  {{ loop.index }}. {{ error | title }}
{% endfor %}
{% else %}
No errors detected.
{% endif %}`;

  const filterBuilder = await PromptBuilder.create(filterTemplate);

  const reportPrompt = await filterBuilder.build({
    company_name: 'Acme Corp',
    date: '2024-11-17',
    status: 'success',
    errors: null,
  });
  console.log(reportPrompt);
}

/**
 * Validation example
 */
async function runValidationExample() {
  console.log('\n\x1b[36m=== Template Validation Example ===\x1b[0m\n');

  const template =
    'Hello {{ name }}! You are {{ age }} years old and work as a {{ job }}.';
  const builder = await PromptBuilder.create(template);

  // Valid variables
  console.log('Test 1: All variables provided');
  const isValid1 = await builder.validate({
    name: 'Alice',
    age: 30,
    job: 'Engineer',
  });
  console.log('Valid:', isValid1);

  if (isValid1) {
    const prompt = await builder.build({
      name: 'Alice',
      age: 30,
      job: 'Engineer',
    });
    console.log('Result:', prompt);
  }

  // Missing variables
  console.log('\nTest 2: Missing required variable (job)');
  const isValid2 = await builder.validate({
    name: 'Bob',
    age: 25,
  });
  console.log('Valid:', isValid2);

  // Extra variables (should still be valid)
  console.log('\nTest 3: Extra variables (should work)');
  const isValid3 = await builder.validate({
    name: 'Charlie',
    age: 35,
    job: 'Designer',
    extra_field: 'ignored',
  });
  console.log('Valid:', isValid3);

  if (isValid3) {
    const prompt = await builder.build({
      name: 'Charlie',
      age: 35,
      job: 'Designer',
      extra_field: 'ignored',
    });
    console.log('Result:', prompt);
  }
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'simple';
  let template = argv.template;
  let variables = argv.variables;

  // Default file paths for file mode
  if (mode === 'file') {
    if (!template) {
      const promptPath = path.join(
        __dirname,
        '..',
        'shared',
        'prompts',
        'basic_prompt.jinja',
      );
      console.warn(
        '\x1b[33mUsing default template file (' + promptPath + ')\x1b[0m',
      );
      template = promptPath;
    }

    if (!variables) {
      const variablesPath = path.join(
        __dirname,
        '..',
        'shared',
        'prompts',
        'basic_prompt_props.json',
      );
      console.warn(
        '\x1b[33mUsing default variables file (' + variablesPath + ')\x1b[0m',
      );
      variables = variablesPath;
    }
  }

  return { mode, template, variables };
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
