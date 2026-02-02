import * as allure from 'allure-js-commons';

import { checkCommandOutput } from '../helpers/check-command-output';
import { runExample } from '../helpers/run-example';

describe('node_random_canned.ts', () => {
  const script = 'node-random-canned';

  const expectedCannedPhrases = [
    "I'm sorry, but I can't respond to that kind of content.",
    "That topic makes me uncomfortable. Let's talk about something else.",
    "I'd prefer not to discuss that. Could we change the subject?",
  ];

  it('should return one of the canned phrases', async () => {
    await allure.suite('Tests for node_random_canned.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for expected output patterns
    expect(output).toContain('Initial phrases:');
    expect(output).toContain('Randomly selected phrase:');

    // Verify all initial phrases are displayed
    expectedCannedPhrases.forEach((phrase, index) => {
      expect(output).toContain(`${index + 1}. ${phrase}`);
    });

    // Verify that one of the canned phrases was selected
    const hasValidPhrase = expectedCannedPhrases.some((phrase) =>
      output.includes(`Randomly selected phrase:\n ${phrase}`),
    );
    expect(hasValidPhrase).toBe(true);
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for node_random_canned.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-random-canned');
    expect(output).toContain('Description:');
    expect(output).toContain('RandomCannedTextNode');
  });

  it('should produce different outputs over multiple runs (randomness test)', async () => {
    await allure.suite('Tests for node_random_canned.ts template');

    const results = new Set<string>();
    const maxRuns = 10;
    const minUniqueResults = 2; // We expect at least 2 different results out of 10 runs

    for (let i = 0; i < maxRuns; i++) {
      const { output, errorOutput, exitCode } = await runExample(script, []);

      expect(exitCode).toBe(0);
      checkCommandOutput(errorOutput, exitCode);

      // Extract the selected phrase
      const match = output.match(/Randomly selected phrase:\n (.+)/);
      expect(match).toBeTruthy();

      if (match) {
        results.add(match[1]);
      }
    }

    // Verify we got some randomness (at least 2 different results)
    expect(results.size).toBeGreaterThanOrEqual(minUniqueResults);

    // Verify all results are valid canned phrases
    results.forEach((result) => {
      expect(expectedCannedPhrases).toContain(result);
    });
  }, 90000); // Longer timeout for multiple runs

  it('should work with any additional arguments (should be ignored)', async () => {
    await allure.suite('Tests for node_random_canned.ts template');
    await allure.story('Random canned text node with extra arguments');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'extra-arg',
      '--someFlag=value',
      'another-arg',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Should still work normally despite extra arguments
    expect(output).toContain('Initial phrases:');
    expect(output).toContain('Randomly selected phrase:');

    // Verify that one of the canned phrases was selected
    const hasValidPhrase = expectedCannedPhrases.some((phrase) =>
      output.includes(`Randomly selected phrase:\n ${phrase}`),
    );
    expect(hasValidPhrase).toBe(true);
  });

  it('should display all phrases in numbered list format', async () => {
    await allure.suite('Tests for node_random_canned.ts template');
    await allure.story('Random canned text node output format');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check numbered list format
    expect(output).toMatch(
      /1\.\s+I'm sorry, but I can't respond to that kind of content\./,
    );
    expect(output).toMatch(
      /2\.\s+That topic makes me uncomfortable\. Let's talk about something else\./,
    );
    expect(output).toMatch(
      /3\.\s+I'd prefer not to discuss that\. Could we change the subject\?/,
    );

    // Check that the selected phrase appears after "Randomly selected phrase:\n "
    expect(output).toMatch(/Randomly selected phrase:\n .+/);
  });

  it('should have consistent phrase count', async () => {
    await allure.suite('Tests for node_random_canned.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Count the number of numbered phrases in output
    const numberedPhrases = output.match(/\d+\.\s+.+/g) || [];
    expect(numberedPhrases.length).toBe(expectedCannedPhrases.length);

    // Verify exactly one phrase is selected
    const selectedPhrases =
      output.match(/Randomly selected phrase:\n (.+)/g) || [];
    expect(selectedPhrases.length).toBe(1);
  });
});
