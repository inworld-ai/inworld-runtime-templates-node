import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

const script = 'model-selector-conditional';

function checkModelSelectorOutputValidation(
  output: string,
  query: string,
  expectedModelA: string = 'gpt-4o-mini',
  expectedModelB: string = 'gpt-4o',
  selectedModel: 'A' | 'B' = 'A',
) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain(`Model A: ${expectedModelA}`);
  expect(output).toContain(`Model B: ${expectedModelB}`);
  expect(output).toContain(
    `=== Testing: "${query}" with Model ${selectedModel} ===`,
  );
  const llmResponseIndex = output.indexOf('LLM Response');
  const dynamicRoutingIndex = output.indexOf(
    '=== Demonstrating Dynamic Routing ===',
  );
  expect(llmResponseIndex).toBeGreaterThan(-1);
  expect(dynamicRoutingIndex).toBeGreaterThan(-1);
  expect(dynamicRoutingIndex).toBeGreaterThan(llmResponseIndex);

  const betweenText = output.substring(
    llmResponseIndex + 'LLM Response'.length,
    dynamicRoutingIndex,
  );
  expect(betweenText.trim().length).toBeGreaterThan(0);
  const firstModelIndex = output.indexOf(
    '=== Testing: "What is 2+2?" with Model A ===',
  );
  const secondModelIndex = output.indexOf(
    '=== Testing: "What is 3+3?" with Model B ===',
  );
  expect(firstModelIndex).toBeGreaterThan(-1);
  expect(secondModelIndex).toBeGreaterThan(-1);
  expect(firstModelIndex).toBeLessThan(secondModelIndex);
  const firstModelResponse = output.substring(
    firstModelIndex,
    secondModelIndex,
  );
  const secondModelResponse = output.substring(secondModelIndex, output.length);
  expect(firstModelResponse).toContain('Content:');
  expect(firstModelResponse).toContain('4');
  expect(secondModelResponse).toContain('Content:');
  expect(secondModelResponse).toContain('6');
}

function checkUsageOutputValidation(output: string) {
  expect(output).toContain('Usage:');
  expect(output).toContain('npm run model-selector-conditional');
  expect(output).toContain('Description:');
  expect(output).toContain('conditional model selection based on a flag');
  expect(output).toContain('--useModelB');
  expect(output).toContain('--modelA=<model-name>');
  expect(output).toContain('--modelB=<model-name>');
  expect(output).toContain('--provider=<service-provider>');
  expect(output).toContain('default=gpt-4o-mini');
  expect(output).toContain('default=gpt-4o');
  expect(output).toContain('Examples:');
}

describe('Tests for model-selector-conditional template', () => {
  it('should execute model selector workflow with default parameters', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Describe me how model selector conditional works';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Verify default models are used
    checkModelSelectorOutputValidation(output, prompt, 'gpt-4o-mini', 'gpt-4o');
  }, 60000);

  it('should execute model selector workflow with Model B when flag provided', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Explain quantum physics';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--useModelB',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      'gpt-4o-mini',
      'gpt-4o',
      'B',
    );
  }, 60000);

  it('should support custom models', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Hello world';
    const customModelA = 'gpt-3.5-turbo';
    const customModelB = 'gpt-4.1';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      `--modelA=${customModelA}`,
      `--modelB=${customModelB}`,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      customModelA,
      customModelB,
      'A',
    );
  }, 60000);

  it('should support modelA selection when modelB is provided', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Test modelA selection';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--useModelA',
      '--modelB=gpt-3.5-turbo',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'A',
    );
  }, 60000);
  it('should support modelA selection', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Test modelA selection';
    const customModelA = 'gpt-3.5-turbo';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--useModelA',
      `--modelA=${customModelA}`,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      customModelA,
      'gpt-4o',
      'A',
    );
  }, 60000);

  it('should support custom model with Model B selection', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Test custom models';
    const customModelA = 'gpt-3.5-turbo';
    const customModelB = 'gpt-4-turbo';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      `--modelA=${customModelA}`,
      `--modelB=${customModelB}`,
      '--useModelB',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      customModelA,
      customModelB,
      'B',
    );
  }, 60000);

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkUsageOutputValidation(output);
  }, 60000);

  it('should handle multi-word prompts correctly', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Explain quantum computing in simple terms';
    const { output, errorOutput, exitCode } = await runExample(script, [
      ...prompt.split(' '),
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      'gpt-4o-mini',
      'gpt-4o',
      'A',
    );
  }, 60000);

  it('should support custom provider parameter', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Test with provider';
    const customModelA = 'gemini-2.5-flash';
    const customModelB = 'gemini-2.5-flash-lite';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      `--modelA=${customModelA}`,
      `--modelB=${customModelB}`,
      '--provider=google',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      customModelA,
      customModelB,
      'A',
    );
  }, 60000);

  it('should support modelB selection', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Validate conditional expressions';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--useModelB',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      'gpt-4o-mini',
      'gpt-4o',
      'B',
    );
  }, 60000);

  it('should handle edge case with empty extra arguments', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const prompt = 'Test with ignored args';
    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--unknownFlag',
      '--randomValue=test',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkModelSelectorOutputValidation(
      output,
      prompt,
      'gpt-4o-mini',
      'gpt-4o',
      'A',
    );
  }, 60000);

  it('should error when no prompt is provided', async () => {
    await allure.suite('Tests for model-selector-conditional template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('model_selector_conditional.ts');
    expect(errorOutput).toContain('Error: You need to provide a prompt.');
    checkUsageOutputValidation(errorOutput);
  }, 60000);
});
