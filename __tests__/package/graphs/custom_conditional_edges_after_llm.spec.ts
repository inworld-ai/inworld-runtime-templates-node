import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

const script = 'custom-conditional-edges-after-llm';

function checkCustomConditionalEdgesOutputValidation(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  // Check for LLM and Custom node results in output
  expect(output).toContain('LLM result:');
  expect(output).toContain('Custom node result:');
  expect(output).toContain('GraphOutputStreamResponse');
}

function extractLLMResult(output: string): {
  content: string;
  done: boolean;
} {
  // Extract LLM result from output - handle multiline format with flexible field ordering
  const llmResultMatch = output.match(
    /LLM result: GraphOutputStreamResponse \{[\s\S]*?data: LLMChatResponse \{[\s\S]*?content: '([^']+)'[\s\S]*?done: (false|true)/,
  );
  expect(llmResultMatch).toBeTruthy();

  const content = llmResultMatch![1];
  const done = llmResultMatch![2] === 'true';

  return { content, done };
}

function extractCustomNodeResult(output: string): {
  message: string;
  done: boolean;
} {
  // Extract custom node result from output - handle multiline format
  const customResultMatch = output.match(
    /Custom node result: GraphOutputStreamResponse \{[\s\S]*?data: '([^']+)'[\s\S]*?done: (false|true)/,
  );
  expect(customResultMatch).toBeTruthy();

  const message = customResultMatch![1];
  const done = customResultMatch![2] === 'true';

  return { message, done };
}

function getExpectedMessage(number: number): string {
  return number > 50
    ? `Generated number is greater than 50: ${number}`
    : `Generated number is less or equal to 50: ${number}`;
}

function getConditionalPath(number: number): 'greater' | 'lessEqual' {
  return number > 50 ? 'greater' : 'lessEqual';
}

function validateNumberInRange(number: number) {
  expect(number).toBeGreaterThanOrEqual(1);
  expect(number).toBeLessThanOrEqual(100);
  expect(Number.isInteger(number)).toBe(true);
}

function validateConditionMet(number: number, message: string): boolean {
  const expectedKeyword =
    number > 50
      ? 'Generated number is greater than 50'
      : 'Generated number is less or equal to 50';
  return message.includes(expectedKeyword);
}

function validateCustomConditionalLogic(
  llmContent: string,
  customMessage: string,
) {
  const number = Number(llmContent);

  // Validate that the number is within expected range
  validateNumberInRange(number);

  // Validate conditional logic using helper function
  const expectedMessage = getExpectedMessage(number);
  expect(customMessage).toBe(expectedMessage);
}

describe('Tests for custom-conditional-edges-after-llm template', () => {
  it('should execute custom conditional edges workflow successfully', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkCustomConditionalEdgesOutputValidation(output);

    // Validate LLM result
    const llmResult = extractLLMResult(output);
    expect(llmResult.done).toBe(false);
    expect(llmResult.content).toMatch(/^\d+$/); // Should be a number

    // Validate custom node result
    const customResult = extractCustomNodeResult(output);
    expect(customResult.done).toBe(false);

    // Validate conditional logic works correctly
    validateCustomConditionalLogic(llmResult.content, customResult.message);

    console.log(`LLM generated: ${llmResult.content}`);
    console.log(`Custom node output: ${customResult.message}`);
  });

  it('should ignore additional command line arguments', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'extra',
      'arguments',
      '--unused-flag',
      '--random=value',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkCustomConditionalEdgesOutputValidation(output);

    // Should still work with additional arguments
    const llmResult = extractLLMResult(output);
    const customResult = extractCustomNodeResult(output);

    validateCustomConditionalLogic(llmResult.content, customResult.message);
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    expect(output).toContain('Usage:');
    expect(output).toContain('npm run custom-conditional-edges-after-llm');
    expect(output).toContain('Description:');
    expect(output).toContain(
      'demonstrates how to create a graph with custom conditional edges',
    );
    expect(output).toContain('random number between 1 and 100');
    expect(output).toContain('greater than 50');
    expect(output).toContain('less or equal to 50');
  });

  it('should handle multiple test runs with different numbers', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    // Run the test multiple times to verify both conditional paths can be taken
    const results: Array<{ number: number; path: 'greater' | 'lessEqual' }> =
      [];

    for (let i = 0; i < 3; i++) {
      const { output, errorOutput, exitCode } = await runExample(script, []);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkCustomConditionalEdgesOutputValidation(output);

      const llmResult = extractLLMResult(output);
      const customResult = extractCustomNodeResult(output);

      const number = Number(llmResult.content);
      const path = getConditionalPath(number);

      results.push({ number, path });

      validateCustomConditionalLogic(llmResult.content, customResult.message);
    }

    // Log results for visibility
    results.forEach((result, index) => {
      console.log(
        `Run ${index + 1}: number=${result.number}, path=${result.path}`,
      );
    });

    // Verify all results are valid
    expect(results.length).toBe(3);
    results.forEach((result) => {
      expect(result.number).toBeGreaterThanOrEqual(1);
      expect(result.number).toBeLessThanOrEqual(100);
      expect(['greater', 'lessEqual']).toContain(result.path);
    });
  });

  it('should validate graph configuration and node setup', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check that the graph is properly configured
    expect(output).toContain('Graph configuration validation passed');

    // Check that both LLM and custom node results are present
    expect(output).toContain('LLM result:');
    expect(output).toContain('Custom node result:');
    expect(output).toContain('GraphOutputStreamResponse');

    // Verify the structure of responses
    expect(output).toMatch(
      /LLM result: GraphOutputStreamResponse \{[\s\S]*?data: LLMChatResponse/,
    );
    expect(output).toMatch(
      /Custom node result: GraphOutputStreamResponse \{[\s\S]*?data: '[^']+'/,
    );
  });

  it('should validate custom JavaScript conditional functions work correctly', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    // Run multiple times to test both conditions
    const results: Array<{
      number: number;
      message: string;
      conditionMet: boolean;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const { output, errorOutput, exitCode } = await runExample(script, []);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      const llmResult = extractLLMResult(output);
      const customResult = extractCustomNodeResult(output);

      const number = Number(llmResult.content);
      const message = customResult.message;

      // Verify the custom JavaScript condition logic using helper function
      const conditionMet = validateConditionMet(number, message);

      results.push({ number, message, conditionMet });

      expect(conditionMet).toBe(true);
    }

    // Log all results
    results.forEach((result, index) => {
      console.log(
        `Test ${index + 1}: ${result.number} -> ${result.message} (condition met: ${result.conditionMet})`,
      );
    });

    // Verify we got varied results (not all the same path)
    const greaterThan50Count = results.filter((r) => r.number > 50).length;
    const lessEqual50Count = results.filter((r) => r.number <= 50).length;

    console.log(
      `Results distribution: >50: ${greaterThan50Count}, <=50: ${lessEqual50Count}`,
    );

    // All conditions should be met
    expect(results.every((r) => r.conditionMet)).toBe(true);
  }, 60000);

  it('should demonstrate difference from expression-based conditional edges', async () => {
    await allure.suite('Tests for custom-conditional-edges-after-llm template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkCustomConditionalEdgesOutputValidation(output);

    // This test verifies that the custom JavaScript functions work

    const llmResult = extractLLMResult(output);
    const customResult = extractCustomNodeResult(output);

    // Both should produce the same logical result
    validateCustomConditionalLogic(llmResult.content, customResult.message);

    console.log(
      `Custom conditional logic processed: ${llmResult.content} -> ${customResult.message}`,
    );
  });
});
