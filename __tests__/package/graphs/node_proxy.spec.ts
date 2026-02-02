import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

const script = 'node-proxy';

function checkProxyOutputValidation(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('Expected input type:');
  expect(output).toContain('=== SUMMARY ===');
  expect(output).toContain('Result count:');
  expect(output).toContain('Final result:');
  expect(output).toContain('✅ Proxy behavior verified:');
}

function extractExpectedInputType(output: string): string {
  const match = output.match(/Expected input type: (\w+)/);
  expect(match).toBeTruthy();
  return match![1];
}

function extractResultCount(output: string): number {
  const match = output.match(/Result count: (\d+)/);
  expect(match).toBeTruthy();
  return parseInt(match![1], 10);
}

function extractFinalResult(output: string): string {
  const match = output.match(/Final result: (.+)/);
  expect(match).toBeTruthy();
  return match![1];
}

function extractProxyVerification(output: string): {
  inputType: string;
  outputType: string;
} {
  const match = output.match(
    /✅ Proxy behavior verified: '(\w+)' input → '(\w+)' output/,
  );
  expect(match).toBeTruthy();
  return {
    inputType: match![1],
    outputType: match![2],
  };
}

describe('Tests for node-proxy template', () => {
  it('should handle text input type example', async () => {
    await allure.suite('Tests for node-proxy template');

    const inputText = 'Hello, how are you?';
    const { output, errorOutput, exitCode } = await runExample(script, [
      inputText,
      '--inputType=text',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkProxyOutputValidation(output);

    // Validate expected input type
    const expectedInputType = extractExpectedInputType(output);
    expect(expectedInputType).toBe('text');

    // Validate result count (should be 1 for proxy node)
    const resultCount = extractResultCount(output);
    expect(resultCount).toBe(1);

    // Validate final result contains the input text
    const finalResult = extractFinalResult(output);
    expect(finalResult).toBe(inputText);

    // Validate proxy behavior verification
    const verification = extractProxyVerification(output);
    expect(verification.inputType).toBe('text');
    expect(verification.outputType).toBe('string');

    // Check that text output is properly logged
    expect(output).toContain(`[1] TEXT: ${inputText}`);

    console.log(`Text proxy test completed: "${inputText}" → "${finalResult}"`);
  });

  it('should handle llm_chat_request input type example', async () => {
    await allure.suite('Tests for node-proxy template');

    const inputJson = '[{\\"role\\": \\"user\\", \\"content\\": \\"Hello!\\"}]';
    const { output, errorOutput, exitCode } = await runExample(script, [
      inputJson,
      '--inputType=llm_chat_request',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkProxyOutputValidation(output);

    // Validate expected input type
    const expectedInputType = extractExpectedInputType(output);
    expect(expectedInputType).toBe('llm_chat_request');

    // Validate result count (should be 1 for proxy node)
    const resultCount = extractResultCount(output);
    expect(resultCount).toBe(1);

    // Validate final result contains the JSON structure
    const finalResult = extractFinalResult(output);
    expect(finalResult).toContain('"role":"user"');
    expect(finalResult).toContain('"content":"Hello!"');

    // Validate proxy behavior verification
    const verification = extractProxyVerification(output);
    expect(verification.inputType).toBe('llm_chat_request');
    expect(verification.outputType).toBe('LLMChatRequest');

    // Check that LLM chat request output is properly logged
    expect(output).toContain('[1] LLM_CHAT_REQUEST:');
    expect(output).toContain('"role": "user"');
    expect(output).toContain('"content": "Hello!"');

    console.log(
      `LLM chat request proxy test completed: ${inputJson.length} chars → JSON output`,
    );
  });

  it('should handle custom input type example', async () => {
    await allure.suite('Tests for node-proxy template');

    const inputJson = '{\\"key\\": \\"value\\", \\"number\\": 42}';
    const { output, errorOutput, exitCode } = await runExample(script, [
      inputJson,
      '--inputType=custom',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkProxyOutputValidation(output);

    // Validate expected input type
    const expectedInputType = extractExpectedInputType(output);
    expect(expectedInputType).toBe('custom');

    // Validate result count (should be 1 for proxy node)
    const resultCount = extractResultCount(output);
    expect(resultCount).toBe(1);

    // Validate final result contains the stringified custom data
    const finalResult = extractFinalResult(output);
    expect(finalResult).toBe('[object Object]'); // String(customObject) returns '[object Object]'

    // Validate proxy behavior verification
    const verification = extractProxyVerification(output);
    expect(verification.inputType).toBe('custom');
    expect(verification.outputType).toBe('Custom');

    // Check that custom object output is properly logged
    expect(output).toContain('[1] UNKNOWN TYPE (Custom):');
    expect(output).toContain('key');
    expect(output).toContain('value');
    expect(output).toContain('42');

    console.log(
      `Custom proxy test completed: ${inputJson} → custom object output`,
    );
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for node-proxy template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    expect(output).toContain('Usage:');
    expect(output).toContain(
      'npm run node-proxy <input-data> -- --inputType=<type>',
    );
    expect(output).toContain('Input Types:');
    expect(output).toContain('--inputType=llm_chat_request');
    expect(output).toContain('--inputType=text');
    expect(output).toContain('--inputType=custom');
    expect(output).toContain('Examples:');
    expect(output).toContain('"Hello, how are you?"');
    expect(output).toContain('[{"role": "user", "content": "Hello!"}]');
    expect(output).toContain('{"key": "value", "number": 42}');
    expect(output).toContain('If you are on Windows');
  });

  it('should error when no input data is provided', async () => {
    await allure.suite('Tests for node-proxy template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--inputType=text',
    ]);
    expect(output).toContain('proxy_node');
    expect(exitCode).toBe(1);
    expect(errorOutput).toContain('You need to provide input data.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when no inputType is provided', async () => {
    await allure.suite('Tests for node-proxy template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'some input',
    ]);
    expect(output).toContain('proxy_node');
    expect(exitCode).toBe(1);
    expect(errorOutput).toContain('You need to specify --inputType.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when unsupported inputType is provided', async () => {
    await allure.suite('Tests for node-proxy template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'some input',
      '--inputType=invalid',
    ]);
    expect(output).toContain('proxy_node');
    expect(exitCode).toBe(1);
    expect(errorOutput).toContain("Unsupported input type 'invalid'.");
    expect(errorOutput).toContain(
      'Supported types: llm_chat_request, text, custom',
    );
    expect(errorOutput).toContain('Usage:');
  });
});
