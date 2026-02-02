import * as allure from 'allure-js-commons';

import { remoteTextCompletionLLMs } from '../../fixtures';
import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function checkLLMCompletionOutputValidation(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
}

function checkLLMCompletionStreamResponse(output: string) {
  expect(output).toContain('📡 LLM Completion Response Stream:');
  expect(output).toMatch(/Result count:\s*\d+/);
  expect(output).toMatch(/Result:\s*[\s\S]+/);
}

function checkNonEmptyResult(output: string) {
  // Extract the result content after "Result:\n"
  const resultMatch = output.match(/Result:\n([\s\S]+)/);
  expect(resultMatch).toBeTruthy();
  const resultText = resultMatch![1].trim();
  expect(resultText.length).toBeGreaterThan(0);
  expect(resultText).not.toBe('');
}

describe('llm_completion.ts', () => {
  const script = 'node-llm-completion';

  const basicTestCases = [
    {
      name: 'usage case example',
      prompt: 'Hello, how',
    },
    {
      name: 'weather statement completion',
      prompt: 'The weather today is',
    },
  ];

  for (const testCase of basicTestCases) {
    it(`should handle ${testCase.name}`, async () => {
      await allure.suite('Tests for llm_completion.ts template');

      const { output, errorOutput, exitCode } = await runExample(script, [
        testCase.prompt,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      checkLLMCompletionOutputValidation(output);
      checkLLMCompletionStreamResponse(output);
      checkNonEmptyResult(output);

      // Should have at least 1 result
      expect(output).toMatch(/Result count:\s*[1-9]\d*/);
    }, 60000);
  }

  it('should handle long input prompt', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const prompt =
      'In the field of artificial intelligence and machine learning, there are many different approaches to solving complex problems that require sophisticated computational techniques and innovative methodologies. One particularly interesting area is natural language processing, which involves teaching computers to understand and generate human language through the use of neural networks, transformer architectures, and attention mechanisms. This field has seen tremendous advances in recent years, particularly with the development of large language models such as GPT, BERT, T5, and their various derivatives and improvements. These models are trained on vast amounts of text data collected from books, articles, websites, and other digital sources, and can perform a wide variety of tasks including text generation, translation, summarization, question answering, sentiment analysis, and creative writing. The training process involves complex optimization algorithms, distributed computing systems, and massive computational resources that can cost millions of dollars and require specialized hardware such as GPUs and TPUs. Furthermore, the development of these systems raises important questions about ethics, bias, fairness, privacy, and the potential societal impacts of artificial intelligence technologies. Researchers and engineers working in this domain must carefully consider issues such as data quality, model interpretability, robustness to adversarial attacks, and the responsible deployment of AI systems in real-world applications. The future of this field likely involves continued scaling of model sizes, improved training methodologies, better understanding of emergent capabilities, and the development of more efficient and sustainable approaches to building and deploying large-scale AI systems that can benefit humanity while minimizing potential risks and negative consequences';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMCompletionOutputValidation(output);
    checkLLMCompletionStreamResponse(output);
    checkNonEmptyResult(output);

    // Should handle long input and provide completion
    expect(output).toMatch(/Result count:\s*[1-9]\d*/);
  }, 60000);

  const modelTestCases = remoteTextCompletionLLMs.map((model) => ({
    name: `${model.provider} provider with ${model.name} model`,
    args: ['--provider', model.provider, '--modelName', model.name],
  }));

  for (const testCase of modelTestCases) {
    it(`should work with ${testCase.name}`, async () => {
      await allure.suite('Tests for llm_completion.ts template');

      const prompt = 'Complete this sentence: The future of AI is';

      const { output, errorOutput, exitCode } = await runExample(script, [
        prompt,
        ...testCase.args,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      checkLLMCompletionOutputValidation(output);
      checkLLMCompletionStreamResponse(output);
      checkNonEmptyResult(output);
    }, 60000);
  }

  it('should handle explicit stream=true', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const prompt = 'Technology has changed our lives by';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--stream=true',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMCompletionOutputValidation(output);
    checkLLMCompletionStreamResponse(output);
    checkNonEmptyResult(output);

    // Streaming should show multiple chunks
    expect(output).toMatch(/Result count:\s*[1-9]\d*/);
  }, 60000);

  it('should handle non-streaming option', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const prompt = 'The benefits of renewable energy include';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
      '--stream=false',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMCompletionOutputValidation(output);

    // With stream=false, we should get a string response instead of stream
    expect(output).toMatch(/Template: Result:.+/);
    expect(output).not.toContain('📡 LLM Completion Response Stream:');

    // Extract the result from "Template: Result: " line
    const templateResultMatch = output.match(/Template: Result:\s*(.+)/);
    expect(templateResultMatch).toBeTruthy();
    const resultText = templateResultMatch![1].trim();
    expect(resultText.length).toBeGreaterThan(0);
  }, 60000);

  it('should error when no prompt is provided', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('llm_completion.ts');
    expect(errorOutput).toContain('You need to provide a prompt.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when empty prompt is provided', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [''], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('llm_completion.ts');
    expect(errorOutput).toContain('You need to provide a prompt.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error with invalid model name', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['Test prompt', '--modelName=invalid-model-name-that-does-not-exist'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('llm_completion.ts');
    expect(errorOutput).toMatch(/(error|invalid|not found|unsupported)/i);
  });

  it('should error with invalid provider', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['Test prompt', '--provider=invalid-provider-name'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('llm_completion.ts');
    expect(errorOutput).toContain('Invalid service provider');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-llm-completion');
    expect(output).toContain('--modelName');
    expect(output).toContain('--provider');
    expect(output).toContain('--stream');
  }, 30000);

  it('should handle prompt with special characters', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const prompt =
      'What does "Hello, World!" mean in programming? It represents';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMCompletionOutputValidation(output);
    checkLLMCompletionStreamResponse(output);
    checkNonEmptyResult(output);
  }, 60000);

  it('should handle prompt with numbers and symbols', async () => {
    await allure.suite('Tests for llm_completion.ts template');

    const prompt = 'The equation 2 + 2 = 4 is an example of';

    const { output, errorOutput, exitCode } = await runExample(script, [
      prompt,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    checkLLMCompletionOutputValidation(output);
    checkLLMCompletionStreamResponse(output);
    checkNonEmptyResult(output);
  }, 60000);
});
