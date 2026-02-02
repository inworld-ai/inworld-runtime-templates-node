import * as allure from 'allure-js-commons';
import path from 'path';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function validateKeywordMatcherOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed');
  expect(output).toContain('=== Keyword Matcher Result ===');
  expect(output).toContain('Result Type: MatchedKeywords');
}

function _checkUsageOutput(output: string) {
  expect(output).toContain('Usage:');
  expect(output).toContain(
    'npm run node-keyword-matcher "Your text to check" ',
  );
  expect(output).toContain(
    '--profanityPath=<profanity-path>[optional, path to profanity.json]',
  );
  expect(output).toContain(
    '--adultPath=<adult-path>[optional, path to adult.json]',
  );
  expect(output).toContain(
    '--substancePath=<substance-path>[optional, path to substance_use.json]',
  );
  expect(output).toContain('Examples:');
  expect(output).toContain('# Test safe content');
  expect(output).toContain(
    'npm run node-keyword-matcher "I love pizza and learning"',
  );
  expect(output).toContain('# Test unsafe content (profanity)');
  expect(output).toContain(
    'npm run node-keyword-matcher "This is fucking stupid"',
  );
  expect(output).toContain('# Test with custom keyword files');
  expect(output).toContain('npm run node-keyword-matcher "Let\'s do drugs"');
  expect(output).toContain('--profanityPath="safety/fixtures/profanity.json"');
  expect(output).toContain('--adultPath="safety/fixtures/adult.json"');
  expect(output).toContain(
    '--substancePath="safety/fixtures/substance_use.json"',
  );
}
describe('keyword_matcher.ts', () => {
  const script = 'node-keyword-matcher';

  it('should detect safe content with no keyword matches', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const safeText = 'I love pizza and learning new things';
    const { output, errorOutput, exitCode } = await runExample(script, [
      safeText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('SAFE: No keyword matches found');
    expect(output).toContain(`Input Text: "${safeText}"`);
  });

  it('should detect profanity keywords', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const profaneText = 'This is fucking stupid';
    const { output, errorOutput, exitCode } = await runExample(script, [
      profaneText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 1 keyword matches:');
    expect(output).toContain('"fucking" (group: profanity)');
    expect(output).toContain(`Input Text: "${profaneText}"`);
  });

  it('should detect adult content keywords', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const adultText = 'This content involves explicit sexual content';
    const { output, errorOutput, exitCode } = await runExample(script, [
      adultText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 1 keyword matches:');
    expect(output).toContain('"sexual" (group: adult)');
    expect(output).toContain(`Input Text: "${adultText}"`);
  });

  it('should detect substance use keywords', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const substanceText = 'Let me buy some crack cocaine';
    const { output, errorOutput, exitCode } = await runExample(script, [
      substanceText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 2 keyword matches:');
    expect(output).toContain('"some crack" (group: substance_use)');
    expect(output).toContain('"cocaine" (group: substance_use)');
    expect(output).toContain(`Input Text: "${substanceText}"`);
  });

  it('should detect multiple keyword categories in one text', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const mixedText = 'This shit involves drugs and sex';
    const { output, errorOutput, exitCode } = await runExample(script, [
      mixedText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 3 keyword matches:');
    expect(output).toContain('"shit" (group: profanity)');
    expect(output).toContain('"drugs" (group: substance_use)');
    expect(output).toContain('"sex" (group: adult)');
    expect(output).toContain(`Input Text: "${mixedText}"`);
  });

  it('should handle edge case with punctuation', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const textWithPunctuation = 'What the fuck!';
    const { output, errorOutput, exitCode } = await runExample(script, [
      textWithPunctuation,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 1 keyword matches:');
    expect(output).toContain('"fuck" (group: profanity)');
    expect(output).toContain(`Input Text: "${textWithPunctuation}"`);
  });

  it('should handle case sensitivity appropriately', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const uppercaseText = 'This is SHIT';
    const { output, errorOutput, exitCode } = await runExample(script, [
      uppercaseText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 1 keyword matches:');
    expect(output).toContain('"shit" (group: profanity)');
    expect(output).toContain(`Input Text: "${uppercaseText}"`);
  });

  it('should count keyword matches correctly', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const textWithKeywords = 'This shit is fucking bad';
    const { output, errorOutput, exitCode } = await runExample(script, [
      textWithKeywords,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);

    expect(output).toContain('UNSAFE: Found 2 keyword matches:');
    expect(output).toContain('"shit" (group: profanity)');
    expect(output).toContain('"fucking" (group: profanity)');
    expect(output).toContain(`Input Text: "${textWithKeywords}"`);
  });

  it('should handle very long text input', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');

    const longText =
      'The quick brown fox jumps over the lazy dog in this lengthy demonstration of processing extended text input for keyword matching capabilities without triggering false positives during analysis';
    const { output, errorOutput, exitCode } = await runExample(script, [
      longText,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);

    expect(output).toContain('SAFE: No keyword matches found');
    expect(output).toContain(`Input Text: "${longText}"`);
  });

  it('should support flags for custom keyword files', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');
    const textWithKeywords = 'Holy shit do drugs and have sex';
    const profanityPath = path.resolve(
      __dirname,
      '../../../src/shared/fixtures/profanity.json',
    );
    const adultPath = path.resolve(
      __dirname,
      '../../../src/shared/fixtures/adult.json',
    );
    const substanceUsePath = path.resolve(
      __dirname,
      '../../../src/shared/fixtures/substance_use.json',
    );
    const { output, errorOutput, exitCode } = await runExample(script, [
      textWithKeywords,
      `--profanityPath="${profanityPath}"`,
      `--adultPath="${adultPath}"`,
      `--substancePath="${substanceUsePath}"`,
    ]);
    checkCommandOutputDetailed(errorOutput, exitCode, output);
    validateKeywordMatcherOutput(output);
    expect(output).toContain('UNSAFE: Found 4 keyword matches:');
    expect(output).toContain('"shit" (group: profanity)');
    expect(output).toContain('"drugs" (group: substance_use)');
    expect(output).toContain('"have sex" (group: adult)');
    expect(output).toContain('"sex" (group: adult)');
    expect(output).toContain(`Input Text: "${textWithKeywords}"`);
  });
  it('should error when custom keyword files are not exist', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');
    const { output, errorOutput, exitCode } = await runExample(
      script,
      [
        'This shit is fucking bad',
        '--profanityPath=nonexistent_file.json',
        '--adultPath=nonexistent_file.json',
        '--substancePath=nonexistent_file.json',
      ],
      { allowAnyNonZeroExit: true },
    );
    expect(exitCode).not.toBe(0);
    expect(output).toContain('keyword_matcher.ts');
    expect(errorOutput).toContain(
      'Error: Could not load keywords from nonexistent_file.json: ENOENT: no such file or directory',
    );
  });
  it('should error when custom keyword files are invalid JSON format', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');
    const profanityPath = path.resolve(
      __dirname,
      '../../fixtures/invalid_format_profanity.json',
    );
    const adultPath = path.resolve(
      __dirname,
      '../../fixtures/invalid_format_adult.json',
    );
    const substanceUsePath = path.resolve(
      __dirname,
      '../../fixtures/invalid_format_substance.json',
    );
    const { output, errorOutput, exitCode } = await runExample(
      script,
      [
        'This shit is fucking bad',
        `--profanityPath="${profanityPath}"`,
        `--adultPath="${adultPath}"`,
        `--substancePath="${substanceUsePath}"`,
      ],
      { allowAnyNonZeroExit: true },
    );
    console.log('script:', script);
    expect(exitCode).not.toBe(0);
    expect(output).toContain('keyword_matcher.ts');
    expect(errorOutput).toContain(
      '❌ Graph configuration validation not passed!',
    );
    expect(errorOutput).toContain('Schema validation errors:');
  });
  it('should error when custom keyword files are not JSON files', async () => {
    await allure.suite('Tests for node_keyword_matcher.ts template');
    const profanityPath = path.resolve(
      __dirname,
      '../../fixtures/text/text_chunking_sample.txt',
    );
    const adultPath = path.resolve(__dirname, '../../fixtures/vad/audio.wav');
    const substanceUsePath = path.resolve(
      __dirname,
      '../../fixtures/prompts/user_prompt.jinja',
    );
    const { output, errorOutput, exitCode } = await runExample(
      script,
      [
        'This shit is fucking bad',
        `--profanityPath="${profanityPath}"`,
        `--adultPath="${adultPath}"`,
        `--substancePath="${substanceUsePath}"`,
      ],
      { allowAnyNonZeroExit: true },
    );
    expect(exitCode).not.toBe(0);
    expect(output).toContain('keyword_matcher.ts');
    expect(errorOutput).toMatch(
      /Error: Could not load keywords from .*text_chunking_sample\.txt: Unexpected token 'A', "Alice was "... is not valid JSON/,
    );
  });
});
