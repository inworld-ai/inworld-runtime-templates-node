import * as allure from 'allure-js-commons';
import * as path from 'path';

import { checkCommandOutput } from './helpers/check-command-output';
import { runExample } from './helpers/run-example';

describe('Check basic_vad.ts', () => {
  const audioPath = path.resolve(__dirname, '../fixtures/vad/audio.wav');

  it('should detect voice activity in audio file (simple mode) @allure.id:5707', async () => {
    await allure.suite('Tests for basic_vad.ts template');
    const { output, errorOutput, exitCode } = await runExample('basic-vad', [
      `--audioFilePath=${audioPath}`,
      '--mode=simple',
    ]);

    // Check that output contains expected sections
    expect(output).toContain('=== Simple Voice Activity Detection Example ===');
    expect(output).toContain('Audio Information:');
    expect(output).toContain('Sample Rate:');
    expect(output).toContain('Duration:');
    expect(output).toContain('Total Samples:');
    expect(output).toContain('Detecting voice activity...');
    expect(output).toContain('Speech Threshold:');
    expect(output).toContain('Result:');

    // Check that it reports status (either speech detected or not detected)
    expect(output).toMatch(
      /Status: (Speech detected at sample \d+|No speech detected)/,
    );

    checkCommandOutput(errorOutput, exitCode, 2);
  }, 30000);

  it('should detect silence in audio file (silence mode) @allure.id:5708', async () => {
    await allure.suite('Tests for basic_vad.ts template');
    const { output, errorOutput, exitCode } = await runExample('basic-vad', [
      `--audioFilePath=${audioPath}`,
      '--mode=silence',
    ]);

    // Check that output contains expected sections
    expect(output).toContain('=== Silence Detection Example ===');
    expect(output).toContain('Audio Information:');
    expect(output).toContain('Detecting silence intervals...');

    // Check that it reports silence intervals (either found or not found)
    expect(output).toMatch(
      /(Found \d+ silence intervals:|No silence detected)/,
    );

    checkCommandOutput(errorOutput, exitCode, 2);
  }, 30000);

  it('should test different thresholds (threshold mode) @allure.id:5709', async () => {
    await allure.suite('Tests for basic_vad.ts template');
    const { output, errorOutput, exitCode } = await runExample('basic-vad', [
      `--audioFilePath=${audioPath}`,
      '--mode=threshold',
    ]);

    // Check that output contains expected sections
    expect(output).toContain('=== Speech Threshold Comparison Example ===');
    expect(output).toContain('Testing different speech thresholds...');
    expect(output).toContain('Threshold: 0.3');
    expect(output).toContain('Threshold: 0.5');
    expect(output).toContain('Threshold: 0.7');
    expect(output).toContain('Threshold: 0.9');

    checkCommandOutput(errorOutput, exitCode, 2);
  }, 30000);

  it('should show device selection (device mode) @allure.id:5710', async () => {
    await allure.suite('Tests for basic_vad.ts template');
    const { output, errorOutput, exitCode } = await runExample('basic-vad', [
      `--audioFilePath=${audioPath}`,
      '--mode=device',
    ]);

    // Check that output contains expected sections
    expect(output).toContain('=== Device Selection Example ===');
    expect(output).toContain('Available Devices');
    expect(output).toContain('Selected Device:');
    expect(output).toContain('Detecting voice activity...');
    expect(output).toContain('Result:');

    checkCommandOutput(errorOutput, exitCode, 2);
  }, 30000);
});
