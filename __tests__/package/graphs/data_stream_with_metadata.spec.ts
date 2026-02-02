import * as allure from 'allure-js-commons';

import { checkCommandOutput } from '../helpers/check-command-output';
import { runExample } from '../helpers/run-example';

function checkDataStreamWithMetadataOutput(output: string, mode: string) {
  expect(output).toContain('Graph configuration validation passed');
  expect(output).toContain('DataStreamWithMetadata Example');
  expect(output).toContain(`Mode: ${mode}`);
  expect(output).toContain('getMetadata()');
  expect(output).toContain('getElementType()');
  expect(output).toContain('toStream()');
  expect(output).toContain('Final Output:');
}

describe('data_stream_with_metadata.ts', () => {
  const script = 'data-stream-with-metadata';

  it('should work with basic mode and text messages', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=basic',
      '"hello"',
      '"world"',
      '"inworld"',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkDataStreamWithMetadataOutput(output, 'basic');

    // Check for expected API output
    expect(output).toContain('getElementType(): "Text"');
    expect(output).toContain('toStream() returned: TextStream');

    // Check final result contains joined messages
    expect(output).toContain('Result:');
    expect(output).toMatch(/hello.*world.*inworld/);
  });

  it('should work with passthrough mode', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=passthrough',
      '"hello"',
      '"world"',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkDataStreamWithMetadataOutput(output, 'passthrough');

    // Check that metadata was enriched by passthrough node
    expect(output).toContain('passedThrough');
    expect(output).toContain('true');

    // Check final result
    expect(output).toContain('Result:');
    expect(output).toMatch(/hello.*world/);
  });

  it('should error when no messages provided for basic mode', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['--mode=basic'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('data_stream_with_metadata.ts');
    expect(errorOutput).toContain('You need to provide at least one message');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when no messages provided for passthrough mode', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { errorOutput, exitCode } = await runExample(
      script,
      ['--mode=passthrough'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(errorOutput).toContain('You need to provide at least one message');
    expect(errorOutput).toContain('Usage:');
  });

  it('should show help when --help flag is provided', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run data-stream-with-metadata');
    expect(output).toContain('DataStreamWithMetadata Example');
    expect(output).toContain('getMetadata()');
    expect(output).toContain('getElementType()');
    expect(output).toContain('toStream()');
  });

  it('should work with single message', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=basic',
      '"single-message"',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkDataStreamWithMetadataOutput(output, 'basic');

    expect(output).toContain('single-message');
    expect(output).toContain('Result:');
  });

  it('should work with multimodal mode (text and audio)', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=multimodal',
      '"hello"',
      '"world"',
      '--chunks=2',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkDataStreamWithMetadataOutput(output, 'multimodal');

    // Check for MultimodalContent stream type
    expect(output).toContain('getElementType(): "MultimodalContent"');
    expect(output).toContain('toStream() returned: MultimodalContentStream');

    // Check that both text and audio items were processed
    expect(output).toContain('text items');
    expect(output).toContain('audio items');
    expect(output).toMatch(/hello.*world/);
  });

  it('should error when no messages provided for multimodal mode', async () => {
    await allure.suite('Tests for data_stream_with_metadata.ts template');

    const { errorOutput, exitCode } = await runExample(
      script,
      ['--mode=multimodal', '--chunks=2'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(errorOutput).toContain('You need to provide at least one message');
    expect(errorOutput).toContain('Usage:');
  });
});
