import * as allure from 'allure-js-commons';

import { remoteLLMModels } from '../../fixtures';
import {
  autoToolChoiceScenarios,
  calculatorToolScenarios,
  invalidModelProviderPairs,
  usageExamples,
  weatherToolScenarios,
} from '../../fixtures/llm_chat';
import { checkCommandOutput } from '../helpers/check-command-output';
import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

export function hasJSONOutputAfter(
  prefix: string,
  input: string,
): boolean | null {
  const idx = input.indexOf(prefix);
  if (idx === -1) return null;

  const afterPrefix = input.slice(idx + prefix.length);

  const match = afterPrefix.match(/{[\s\S]*}/);
  if (!match) return null;

  try {
    JSON.parse(match[0]);
    return true;
  } catch {
    return false;
  }
}

function checkToolCalls(
  output: string,
  expectedToolCalls: (string | string[])[],
  expectedExpressions?: string[],
) {
  // Extract the section after "Tool Calls from Stream:"
  const toolCallsStart = output.indexOf('Tool Calls from Stream:');
  expect(toolCallsStart).toBeGreaterThan(-1);

  const toolCallsSection = output.substring(toolCallsStart);

  // Check that each expected tool name and parameters appear (flexible with JSON spacing)
  expectedToolCalls.forEach((toolCall) => {
    if (typeof toolCall === 'string') {
      expect(toolCallsSection.replace(/\s+/g, '')).toContain(
        toolCall.replace(/\s+/g, ''),
      );
    } else if (Array.isArray(toolCall) && expectedExpressions) {
      const hasValidExpression = expectedExpressions.some((expr) =>
        toolCallsSection
          .replace(/\s+/g, '')
          .includes(`calculator({"expression":"${expr}`.replace(/\s+/g, '')),
      );
      if (!hasValidExpression) {
        console.error(
          `None of the expected expressions were found in toolCallsSection.\nExpected one of: ${JSON.stringify(
            expectedExpressions,
          )}\nActual toolCallsSection: ${toolCallsSection}`,
        );
      }
      expect(hasValidExpression).toBe(true);
    }
  });

  // Check that we have the expected number of "ID: call_" patterns
  const idMatches = toolCallsSection.match(/ID:\s+call_\w+/g);
  expect(idMatches).toBeTruthy();
  expect(idMatches!.length).toBe(expectedToolCalls.length);
}

function checkLLMChatOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('📡 LLM Chat Response Stream:');
  expect(output).toMatch(/\s+Total chunks:\s+\d+/);
  expect(output).toMatch(/Final content length:\s+\d+\s+characters/);
}

function checkLLMChatOutputNoStream(output: string) {
  expect(output).toContain('📥 LLM Chat Response:');
  expect(output).toContain('Content:');
}

describe('node_llm_chat.ts', () => {
  const script = 'node-llm-chat';

  it('should work with default parameters', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      usageExamples.defaultParameters.input,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for expected output patterns
    checkLLMChatOutput(output);
    expect(output).toContain('Vancouver');
    expect(output).toContain('weather');
    expect(output).toContain('2 + 2');
    expect(output).toContain('4');
  });

  for (const model of remoteLLMModels) {
    it(`should work with ${model.name} model name and ${model.provider} provider`, async () => {
      await allure.suite('Tests for node_llm_chat.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        usageExamples.defaultParameters.input,
        `--modelName=${model.name}`,
        `--provider=${model.provider}`,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      checkLLMChatOutput(output);
    });
  }

  for (const {
    modelName,
    provider,
    expectedError,
  } of invalidModelProviderPairs) {
    it(`should error with invalid model-provider pair: ${modelName} + ${provider}`, async () => {
      await allure.suite('Tests for node_llm_chat.ts template');

      const { output, errorOutput, exitCode } = await runExample(
        script,
        ['"Hello"', `--modelName=${modelName}`, `--provider=${provider}`],
        { allowAnyNonZeroExit: true },
      );

      expect(exitCode).not.toBe(0);
      expect(output).toContain('llm_chat.ts');
      expect(errorOutput).toContain(expectedError);
    });
  }

  for (const scenario of autoToolChoiceScenarios) {
    it(`should handle auto tool selection for ${scenario.userInput}`, async () => {
      await allure.suite('Tests for node_llm_chat.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        `"${scenario.userInput}"`,
        '--tools',
        '--toolChoice=auto',
        '--modelName=gpt-4o-mini',
        '--provider=openai',
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      checkLLMChatOutput(output);
      checkToolCalls(output, scenario.expectedTools);
    });
  }
  it('should handle auto tool selection for unrelated topics', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      `"Tell me an interesting fact about space exploration"`,
      '--tools',
      '--toolChoice=auto',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMChatOutput(output);
    expect(output).not.toContain('Tool Calls from Stream:');
  });

  for (const scenario of weatherToolScenarios) {
    it(`should use weather tool and extract location for ${scenario.name}`, async () => {
      await allure.suite('Tests for node_llm_chat.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        `"${scenario.userInput}"`,
        `--tools`,
        '--toolChoice=get_weather',
        '--modelName=gpt-4o-mini',
        '--provider=openai',
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      checkLLMChatOutput(output);
      checkToolCalls(output, [
        `get_weather({"location":"${scenario.expectedLocation}`,
      ]);
    });
  }

  const runCalculatorScenario = async (
    scenario: (typeof calculatorToolScenarios)[number],
  ) => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      `"${scenario.userInput}"`,
      `--tools`,
      '--toolChoice=calculator',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMChatOutput(output);
    checkToolCalls(
      output,
      [scenario.expectedExpressions],
      scenario.expectedExpressions,
    );
  };

  for (const scenario of calculatorToolScenarios) {
    const testTitle = `should use calculator tool and extract expression for ${scenario.name}`;
    const testFn = async () => runCalculatorScenario(scenario);

    if (scenario.name === 'percentage calculation') {
      describe('Calculator tool scenario – percentage calculation', () => {
        jest.retryTimes(3);
        it(testTitle, testFn);
      });
      continue;
    }

    it(testTitle, testFn);
  }

  it('should handle basic request with auto tool choice', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { input, args, expectedTools } = usageExamples.basicAutoToolChoice;
    const { output, errorOutput, exitCode } = await runExample(script, [
      input,
      ...args,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkLLMChatOutput(output);
    checkToolCalls(output, expectedTools);
  });

  it('should handle multiple tools with streaming', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { input, args, expectedTools } = usageExamples.multipleToolsStreaming;
    const { output, errorOutput, exitCode } = await runExample(script, [
      input,
      ...args,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkLLMChatOutput(output);
    checkToolCalls(output, expectedTools);
  });

  it('should handle specific tool choice', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { input, args, expectedTools } = usageExamples.specificToolChoice;
    const { output, errorOutput, exitCode } = await runExample(script, [
      input,
      ...args,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkLLMChatOutput(output);
    checkToolCalls(output, expectedTools);
  });

  it('should handle multimodal request with image', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { input, args, imageUrl } = usageExamples.multimodal;
    const { output, errorOutput, exitCode } = await runExample(script, [
      input,
      ...args,
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    checkLLMChatOutput(output);
    expect(output).toContain(`imageUrl ${imageUrl}`);
  });

  it('should handle streaming disabled', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { input, args } = usageExamples.streamingDisabled;
    const { output, errorOutput, exitCode } = await runExample(script, [
      input,
      ...args,
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkLLMChatOutputNoStream(output);
  });

  it('should handle response format JSON', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Generate a user profile for a software engineer. Include name, profession, experience_years, skills array, and location. return in json format"',
      '--modelName=gpt-4o-mini',
      '--provider=openai',
      '--responseFormat=json',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    expect(
      hasJSONOutputAfter('LLM Chat Response Stream:', output),
    ).toBeTruthy();
    expect(output).toContain('📡 LLM Chat Response Stream:');
    expect(output).toMatch(/Total chunks:\s+\d+/);
    expect(output).toMatch(/Final content length:\s+\d+\s+characters/);
  });

  it('should error when no prompt is provided', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('llm_chat.ts');
    expect(errorOutput).toContain('You need to provide a prompt.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for node_llm_chat.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-llm-chat');
    expect(output).toContain('Examples:');
  });
});
