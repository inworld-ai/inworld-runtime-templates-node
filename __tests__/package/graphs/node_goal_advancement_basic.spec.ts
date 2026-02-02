import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function checkGoalAdvancementOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('📊 Goal Advancement Result:');
  expect(output).toMatch(/✅\s*Activated Goals:|❌\s*No goals activated/);
}

describe('basic_goal_advancement.ts', () => {
  const script = 'basic-goal-advancement';

  it('should activate age_question goal when user mentions age', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I\'m 25 years old"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should activate age_question goal
    expect(output).toContain('✅ Activated Goals:');
    expect(output).toContain('age_question');
    expect(output).toContain('🎯 Current Active Goals:');
  });

  it('should process hobby information', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I like playing basketball"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should process and show goal activation (may activate any goal depending on LLM)
    expect(output).toContain('✅ Activated Goals:');
  });

  it('should process location information', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I live in San Francisco"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should process and show goal status (may or may not activate depending on LLM)
    expect(output).toContain('📊 Goal Advancement Result:');
  });

  it('should handle multiple pieces of information', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I\'m 30 years old and live in Boston"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should process all information and show results
    expect(output).toContain('📊 Goal Advancement Result:');
  });

  it('should handle generic conversation', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hello, how are you?"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // May or may not activate goals depending on LLM interpretation
    expect(output).toContain('📊 Goal Advancement Result:');
  });

  it('should handle empty conversation history', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Tell me about yourself"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should process even with minimal context
    expect(output).toContain('📊 Goal Advancement Result:');
  });

  it('should show goal status sections', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I am 28 years old"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should show goal status structure
    expect(output).toContain('📊 Goal Advancement Result:');
    expect(output).toContain('────────');
  });

  it('should error when no message is provided', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('basic_goal_advancement.ts');
    expect(errorOutput).toContain('Usage:');
    expect(errorOutput).toContain('npm run basic-goal-advancement');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run basic-goal-advancement');
    expect(output).toContain('Examples:');
  });

  it('should work with custom provider', async () => {
    await allure.suite('Tests for basic_goal_advancement.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I\'m 35 years old"',
      '--provider=openai',
      '--modelName=gpt-4o-mini',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkGoalAdvancementOutput(output);

    // Should successfully process with custom provider
    expect(output).toContain('✅ Graph configuration validation passed.');
  });
});
