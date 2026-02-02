import * as allure from 'allure-js-commons';
import * as fs from 'fs';
import * as path from 'path';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

describe('node_tts.ts', () => {
  const script = 'node-tts';
  const outputDir = path.resolve(
    __dirname,
    '../../../src/data-output/tts_samples',
  );
  const outputAudioFile = path.resolve(outputDir, 'node_tts_output.wav');
  const outputTimestampFile = path.resolve(
    outputDir,
    'node_tts_timestamps.json',
  );

  beforeEach(() => {
    if (fs.existsSync(outputAudioFile)) {
      fs.unlinkSync(outputAudioFile);
    }
    if (fs.existsSync(outputTimestampFile)) {
      fs.unlinkSync(outputTimestampFile);
    }
  });

  afterEach(() => {
    if (fs.existsSync(outputAudioFile)) {
      fs.unlinkSync(outputAudioFile);
    }
    if (fs.existsSync(outputTimestampFile)) {
      fs.unlinkSync(outputTimestampFile);
    }
  });

  it('should generate audio with default parameters', async () => {
    await allure.suite('Tests for node_tts.ts template');
    const text = 'Hello, this is a test message';

    const { output, errorOutput, exitCode } = await runExample(script, [text]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for expected output patterns
    allure.attachment('Output directory', outputDir, 'text/plain');
    allure.attachment('Output', output, 'text/plain');
    expect(output).toMatch(/Result count: \d+/);
    expect(output).toContain(`Initial text: ${text}`);
    expect(output).toMatch(
      /Audio saved to .*[/\\]data-output[/\\]tts_samples[/\\]node_tts_output\.wav/,
    );
    // Verify the audio file was created
    expect(fs.existsSync(outputAudioFile)).toBe(true);

    // Verify the file has content
    const stats = fs.statSync(outputAudioFile);
    expect(stats.size).toBeGreaterThan(0);
  });

  it('should generate audio with custom voice', async () => {
    await allure.suite('Tests for node_tts.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'This is a test with a custom voice.',
      '--voiceName=Sarah',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for expected output patterns
    expect(output).toMatch(/Result count: \d+/);
    expect(output).toMatch(/Initial text: .*/);
    expect(output).toMatch(
      /Audio saved to .*[/\\]data-output[/\\]tts_samples[/\\]node_tts_output\.wav/,
    );
    expect(output).toMatch(
      /Timestamps saved to .*[/\\]data-output[/\\]tts_samples[/\\]node_tts_timestamps\.json/,
    );

    // Verify the audio and timestamps files were created
    expect(fs.existsSync(outputAudioFile)).toBe(true);
    expect(fs.existsSync(outputTimestampFile)).toBe(true);

    // Verify the files have content
    const stats = fs.statSync(outputAudioFile);
    expect(stats.size).toBeGreaterThan(0);
    const statsTimestamp = fs.statSync(outputTimestampFile);
    expect(statsTimestamp.size).toBeGreaterThan(0);
  });

  const ttsModels = ['inworld-tts-1', 'inworld-tts-1-max'];

  for (const modelId of ttsModels) {
    it(`should generate audio with ${modelId} model`, async () => {
      await allure.suite('Tests for node_tts.ts template');

      const text = 'Testing with a custom model ID.';

      const { output, errorOutput, exitCode } = await runExample(script, [
        text,
        `--modelId=${modelId}`,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);

      // Check for expected output patterns
      expect(output).toMatch(/Result count: \d+/);
      expect(output).toContain(`Initial text: ${text}`);
      expect(output).toMatch(
        /Audio saved to .*[/\\]data-output[/\\]tts_samples[/\\]node_tts_output\.wav/,
      );

      // Verify the audio and timestamps files were created
      expect(fs.existsSync(outputAudioFile)).toBe(true);
      expect(fs.existsSync(outputTimestampFile)).toBe(true);

      // Verify the files have content
      const stats = fs.statSync(outputAudioFile);
      expect(stats.size).toBeGreaterThan(0);
      const statsTimestamp = fs.statSync(outputTimestampFile);
      expect(statsTimestamp.size).toBeGreaterThan(0);
    });
  }

  it('should error when no text is provided', async () => {
    await allure.suite('Tests for node_tts.ts template');
    await allure.story('TTS node error handling - missing text');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('text_to_speech.ts');
    expect(errorOutput).toContain('You need to provide text.');
    expect(errorOutput).toContain('Usage:');
  });
  it('should error when wrong model id is provided', async () => {
    await allure.suite('Tests for node_tts.ts template');
    await allure.story('TTS node error handling - wrong model id');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['Test text', '--modelId=wrong-model-id'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('text_to_speech.ts');
    expect(errorOutput).toContain('Failed to read TTS output stream.');
    expect(errorOutput).toContain('InworldError');
  });
  it('should error when wrong voice name is provided', async () => {
    await allure.suite('Tests for node_tts.ts template');
    await allure.story('TTS node error handling - wrong voice name');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['Test text', '--voiceName=wrong-voice-name'],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('text_to_speech.ts');
    expect(errorOutput).toContain('Unknown voice: wrong-voice-name not found!');
    expect(errorOutput).toContain('InworldError');
  });
});
