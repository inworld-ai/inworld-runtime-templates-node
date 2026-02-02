import * as allure from 'allure-js-commons';
import * as fs from 'fs';
import * as path from 'path';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

// Load the intents configuration to use in tests
const intentsPath = path.resolve(
  __dirname,
  '../../../src/shared/fixtures/intents.json',
);
console.log('intentsPath:', intentsPath);
const intents = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));

function checkIntentOutputValidation(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
}

function extractIntentMatches(
  output: string,
): Array<{ intentName: string; score: number }> {
  expect(output).toContain('Intent matches:');

  // Use a more flexible approach - extract everything after "Intent matches:"
  const afterMatches = output.match(/Intent matches:\s*(\[[\s\S]*?\])/);

  let matches;
  try {
    // Handle the JavaScript-style object notation that might come from console.log
    // Convert single quotes to double quotes for proper JSON
    let jsonString = afterMatches![1];

    jsonString = jsonString.replace(/(\w+)\s*:/g, '"$1":');

    matches = JSON.parse(jsonString);
  } catch (error) {
    // If JSON.parse fails, try to use eval as fallback (for JS object notation)
    try {
      matches = eval(afterMatches![1]);
    } catch (evalError) {
      throw new Error(
        `Failed to parse intent matches: "${afterMatches}" (JSON Error: ${error}, Eval Error: ${evalError}). Output: ${output}`,
      );
    }
  }

  expect(Array.isArray(matches)).toBe(true);

  // Validate structure of each match
  matches.forEach((match: any) => {
    expect(match).toHaveProperty('intentName');
    expect(match).toHaveProperty('score');
    expect(typeof match.intentName).toBe('string');
    expect(typeof match.score).toBe('number');
  });

  return matches;
}

function checkSingleIntentMatch(
  output: string,
  expectedIntentName: string,
  minScore = 0.75,
) {
  const matches = extractIntentMatches(output);

  expect(matches.length).toBe(1); // Expect exactly one match

  const match = matches[0];
  const intentName = match.intentName;
  const score = match.score;

  // Validate the expected intent name
  expect(intentName).toBe(expectedIntentName);

  // Validate score is within valid range and above threshold
  expect(score).toBeGreaterThanOrEqual(minScore);
  expect(score).toBeLessThanOrEqual(1.0);

  console.log(`Intent match: name="${intentName}", score=${score}`);

  return { intentName, score };
}

function checkExactIntentMatch(output: string, expectedIntentName: string) {
  const { intentName, score } = checkSingleIntentMatch(
    output,
    expectedIntentName,
  );

  // For exact matches, expect a perfect score of 1.0
  expect(score).toBe(1.0);

  console.log(
    `Exact intent match confirmed: name="${intentName}", score=${score}`,
  );
}

function checkCloseIntentMatch(
  output: string,
  expectedIntentName: string,
  minScore = 0.75,
) {
  const { intentName, score } = checkSingleIntentMatch(
    output,
    expectedIntentName,
    minScore,
  );

  // For close matches, expect above threshold but likely less than perfect
  expect(score).toBeGreaterThanOrEqual(minScore);
  expect(score).toBeLessThan(1.0); // Should be less than perfect for variations

  console.log(
    `Close intent match confirmed: name="${intentName}", score=${score}`,
  );
}

function checkNoIntentMatches(output: string) {
  const matches = extractIntentMatches(output);
  expect(matches.length).toBe(0);
}

describe('Tests for intent_matching.ts template', () => {
  const script = 'node-intent';

  intents.forEach((intent: any) => {
    intent.phrases.slice(0, 2).forEach((phrase: string) => {
      it(`should match exact phrase "${phrase}" to ${intent.name}`, async () => {
        await allure.suite('Tests for intent_matching.ts template');

        const { output, errorOutput, exitCode } = await runExample(script, [
          phrase,
        ]);

        checkCommandOutputDetailed(errorOutput, exitCode, output);
        checkIntentOutputValidation(output);
        checkExactIntentMatch(output, intent.name);
      });
    });
  });

  const closePhrasesTestCases = [
    {
      phrase: 'What was your childhood like?',
      expectedIntent: 'ask_about_personal_life',
      description: 'childhood variation',
    },
    {
      phrase: 'Which house are you in?',
      expectedIntent: 'ask_about_hogwarts',
      description: 'house sorting variation',
    },
    {
      phrase: 'Tell me about He-Who-Must-Not-Be-Named',
      expectedIntent: 'ask_about_voldemort',
      description: 'Voldemort synonym variation',
    },
    {
      phrase: 'Are you into Quidditch?',
      expectedIntent: 'ask_about_quidditch',
      description: 'Quidditch playing variation',
    },
    {
      phrase: 'What animal is your Patronus?',
      expectedIntent: 'ask_about_patronus',
      description: 'Patronus animal variation',
    },
  ];

  closePhrasesTestCases.forEach((testCase) => {
    it(`should match ${testCase.description}: "${testCase.phrase}"`, async () => {
      await allure.suite('Tests for intent_matching.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        testCase.phrase,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkIntentOutputValidation(output);
      checkCloseIntentMatch(output, testCase.expectedIntent);
    });
  });

  const noMatchTestCases = [
    'What is the weather like today?',
    'How do I cook pasta?',
    'Tell me about artificial intelligence',
    'What is the capital of France?',
    'How to fix a computer?',
    'Random unrelated text that should not match anything',
  ];

  noMatchTestCases.forEach((phrase) => {
    it(`should not match unrelated phrase: "${phrase}"`, async () => {
      await allure.suite('Tests for intent_matching.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        phrase,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkIntentOutputValidation(output);
      checkNoIntentMatches(output);
    });
  });

  it('should handle very short input', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, ['Hi']);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkIntentOutputValidation(output);
    // Very short input might or might not match, just ensure it doesn't crash
    expect(output).toContain('Intent matches:');
  });

  it('should handle input with special characters', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const phrase = 'What house are you in? !!! ??? ...';

    const { output, errorOutput, exitCode } = await runExample(script, [
      phrase,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkIntentOutputValidation(output);
    expect(output).toContain('Intent matches:');
  });

  it('should handle long input', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    // Use a longer phrase that extends a known intent but tests handling of additional context
    const longPhrase =
      'Tell me about your time at Hogwarts and what you learned there, including your favorite classes and memories';

    const { output, errorOutput, exitCode } = await runExample(script, [
      longPhrase,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkIntentOutputValidation(output);
    expect(output).toContain('Intent matches:');
    // Long text about Hogwarts should likely match hogwarts intent but not perfectly
    checkCloseIntentMatch(output, 'ask_about_hogwarts');
  });

  it('should error when no input is provided', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('intent_matching.ts');
    expect(errorOutput).toContain(
      'You need to provide the text to match intents.',
    );
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when empty string is provided', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [''], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('intent_matching.ts');
    expect(errorOutput).toContain(
      'You need to provide the text to match intents.',
    );
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when file does not exist', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['--file=nonexistent_file.txt'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('intent_matching.ts');
    expect(errorOutput).toContain('File not found:');
    expect(errorOutput).toContain('nonexistent_file.txt');
  });

  it('should handle long Hogwarts-related text input', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    const longText =
      'Tell me about your time at Hogwarts and what house you were in, and all the magical experiences you had there.';

    const { output, errorOutput, exitCode } = await runExample(script, [
      longText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkIntentOutputValidation(output);
    checkCloseIntentMatch(output, 'ask_about_hogwarts');
  });

  it('should process input with custom intents from JSON file', async () => {
    await allure.suite('Tests for intent_matching.ts template');

    // Create a temporary custom intents file
    const customIntentsPath = path.resolve(
      __dirname,
      '../../fixtures/custom_test_intents.json',
    );

    const customIntents = [
      {
        name: 'test_greeting',
        phrases: ['Hello there', 'Hi friend'],
      },
    ];

    fs.writeFileSync(customIntentsPath, JSON.stringify(customIntents, null, 2));

    try {
      const { output, errorOutput, exitCode } = await runExample(script, [
        'Hello there',
        `--file=${customIntentsPath}`,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkIntentOutputValidation(output);
      expect(output).toContain(`Reading input from file: ${customIntentsPath}`);
      checkExactIntentMatch(output, 'test_greeting');
    } finally {
      // Clean up custom intents file
      if (fs.existsSync(customIntentsPath)) {
        fs.unlinkSync(customIntentsPath);
      }
    }
  });
});
