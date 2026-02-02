import * as allure from 'allure-js-commons';

import { checkCommandOutput } from '../helpers/check-command-output';
import { runExample } from '../helpers/run-example';

function checkCustomLLMStreamWithDatastoreOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain(
    'Text stream for user: Sherlock Holmes (derived from CustomDatastoreWriterNode)',
  );
  expect(output).toContain(
    'Living at Baker Street, 221B, London, UK (the address derived from initial datastore data):',
  );
}

describe('custom_llm_stream_with_datastore.ts', () => {
  const script = 'node-custom-llm-stream-with-datastore';

  it('should stream LLM response with provided prompt @allure.id:9052', async () => {
    await allure.suite(
      'Tests for custom_llm_stream_with_datastore.ts template',
    );

    const { output, errorOutput, exitCode } = await runExample(script, [
      '"Hello, how are you today?"',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkCustomLLMStreamWithDatastoreOutput(output);

    // Should contain the streaming response
    expect(output).toMatch(/LLM stream result:\s*.+/);

    // Verify the prompt was processed
    const outputLines = output.split('\n');
    const streamContent = outputLines.find((line) =>
      line.includes('LLM stream result:'),
    );
    expect(streamContent).toBeTruthy();
    expect(streamContent?.length).toBeGreaterThan('LLM stream result: '.length);
  });

  it('should error when no prompt is provided @allure.id:9053', async () => {
    await allure.suite(
      'Tests for custom_llm_stream_with_datastore.ts template',
    );

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('custom_llm_stream_with_datastore.ts');
    expect(errorOutput).toContain('You need to provide a prompt.');
    expect(errorOutput).toContain('Usage:');
    expect(errorOutput).toContain(
      'npm run node-custom-llm-stream-with-datastore',
    );
  });

  it('should show help when --help flag is provided @allure.id:9054', async () => {
    await allure.suite(
      'Tests for custom_llm_stream_with_datastore.ts template',
    );

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-custom-llm-stream-with-datastore');
    expect(output).toContain('Description:');
    expect(output).toContain(
      'demonstrates how to create a custom node that streams a LLM response',
    );
  });
});
