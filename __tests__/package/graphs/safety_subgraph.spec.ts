import * as allure from 'allure-js-commons';

import { checkCommandOutput } from '../helpers/check-command-output';
import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function checkSafetySubgraphOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('=== Final Safety Result ===');
  expect(output).toContain('Safety Decision:');
  expect(output).toContain('Input Text:');
  expect(output).toContain('Result Type: SafetyResult');
}

function extractSafetyResult(output: string): {
  isSafe: string;
  inputText: string;
} {
  // More robust patterns to handle different output formats
  const safetyDecisionMatch = output.match(/Safety Decision:\s*(SAFE|UNSAFE)/i);
  const inputTextMatch = output.match(/Input Text:\s*"([^"]+)"/i);

  if (!safetyDecisionMatch) {
    console.log('Failed to match Safety Decision in output:', output);
    allure.attachment('Output', output, 'text/plain');
    throw new Error('Could not find Safety Decision in output');
  }

  if (!inputTextMatch) {
    console.log('Failed to match Input Text in output:', output);
    throw new Error('Could not find Input Text in output');
  }

  const isSafe = safetyDecisionMatch![1];
  const inputText = inputTextMatch![1];

  return { isSafe, inputText };
}

describe('safety_subgraph.ts', () => {
  const script = 'safety-subgraph';

  it('should classify safe content correctly', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I love learning about science and technology"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('SAFE');
    expect(inputText).toContain('I love learning about science and technology');
  });

  it('should detect selfharm content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I want to hurt myself and end my life"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain('I want to hurt myself and end my life');
  });

  it('should detect substance content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Let\'s do drugs and get high"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain("Let's do drugs and get high");
  });

  it('should detect hategroup content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I hate all people from that ethnic group"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain('I hate all people from that ethnic group');
  });

  it('should detect sexual content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Let me describe explicit sexual activities in detail"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain(
      'Let me describe explicit sexual activities in detail',
    );
  });

  it('should detect sexualminors content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I have inappropriate thoughts about children"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain('I have inappropriate thoughts about children');
  });

  // TODO: FIXME - profanity model is not working
  /*

  it('should detect profanity via keyword matching', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"This is damn annoying and fucking stupid"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(isSafe).toBe('UNSAFE');
    expect(inputText).toContain('This is damn annoying and fucking stupid');
  });*/

  it('should error when no text is provided', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('safety_pipeline.ts');
    expect(errorOutput).toContain(
      'You need to provide text to check for safety.',
    );
    expect(errorOutput).toContain('Usage:');
    expect(errorOutput).toContain('npm run safety-subgraph');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');
    await allure.story('Safety subgraph help output');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run safety-subgraph');
    expect(output).toContain('Examples:');
    expect(output).toContain('# Test safe content');
    expect(output).toContain('# Test unsafe content');
    expect(output).toContain('--classifierWeightsModelPath=');
    expect(output).toContain('--profanityPath=');
    expect(output).toContain('--adultPath=');
    expect(output).toContain('--substancePath=');
  });

  it('should handle edge cases and borderline content', async () => {
    await allure.suite('Tests for safety_subgraph.ts template');
    await allure.story('Safety subgraph edge cases');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"This movie has violence but it\'s fictional entertainment"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkSafetySubgraphOutput(output);

    const { isSafe, inputText } = extractSafetyResult(output);

    expect(inputText).toContain(
      "This movie has violence but it's fictional entertainment",
    );
    expect(isSafe).toBe('SAFE');
  });
});
