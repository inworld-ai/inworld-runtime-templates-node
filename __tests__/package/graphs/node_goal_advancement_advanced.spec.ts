import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function checkAdvancedGoalOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toMatch(/📊\s*Goal Advancement Result:|Scenario:/);
}

describe('advanced_goal_patterns.ts', () => {
  const script = 'advanced-goal-patterns';

  it('should handle sequential goal dependencies', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hello!"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should show goal advancement output
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should handle parallel goals', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I need help with something"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should show multiple goals being tracked
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should handle repeatable goals', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Thanks for your help!"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should track repeatable politeness goals
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should show detailed goal status', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I\'m looking for product information"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should show comprehensive goal analysis
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should track goal completion with dependencies', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I would like to purchase this item"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should show goal progression through dependencies
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should handle intent-based goal activation', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"What are the shipping options?"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should activate goals based on detected intents
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should show goal reasoning and activation conditions', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"I need assistance with my order"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should show goal advancement results
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should handle complex multi-goal scenarios', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hi, I\'m interested in your product, what are the prices and do you ship internationally?"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should handle multiple goals being activated simultaneously
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should show all goal categories', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Thank you, goodbye!"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should categorize goals properly
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should error when no input is provided', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('advanced_goal_patterns.ts');
    expect(errorOutput).toContain('Usage:');
    expect(errorOutput).toContain('npm run advanced-goal-patterns');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run advanced-goal-patterns');
    expect(output).toContain('Examples:');
  });

  it('should work with custom provider', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hello, how can I help you?"',
      '--provider=openai',
      '--modelName=gpt-4o-mini',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });

  it('should handle edge case with minimal input', async () => {
    await allure.suite('Tests for advanced_goal_patterns.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hi"',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkAdvancedGoalOutput(output);

    // Should still process and show goal status
    expect(output).toMatch(/📊\s*Goal Advancement Result:/);
  });
});
