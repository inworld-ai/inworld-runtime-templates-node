import * as allure from 'allure-js-commons';
import * as path from 'path';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

describe('speech_to_text.ts', () => {
  const script = 'node-stt';
  const validAudioPath = path.resolve(
    __dirname,
    '../../fixtures/stt/audio.wav',
  );
  const invalidPath = path.resolve(
    __dirname,
    '../../fixtures/stt/nonexistent.wav',
  );
  const wrongFormatPath = path.resolve(
    __dirname,
    '../../fixtures/prompts/user_prompt.jinja',
  );

  it('should transcribe audio with valid path @allure.id:7841', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      `--audioFilePath=${validAudioPath}`,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for expected output patterns
    expect(output).toMatch(/Result count: \d+/);
    expect(output).toMatch(/Result: .+/);
    // The audio file should contain "How can I assist you today?"
    expect(output).toContain('How can I assist you today');
  }, 60000);

  it('should error when audio file path does not exist @allure.id:8959', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      [`--audioFilePath=${invalidPath}`],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('speech_to_text.ts');
    expect(errorOutput).toContain('ENOENT: no such file or directory');
    expect(errorOutput).toContain(invalidPath);
  });

  it('should error when no audio file path is provided @allure.id:8964', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [], {
      allowAnyNonZeroExit: true,
    });

    expect(exitCode).not.toBe(0);
    expect(output).toContain('speech_to_text.ts');
    expect(errorOutput).toContain('You need to provide a audioFilePath.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should error when provided file is not in WAV format @allure.id:8951', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      [`--audioFilePath=${wrongFormatPath}`],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('speech_to_text.ts');
    // The WAV decoder should fail with a parsing error
    expect(errorOutput).toMatch(/(invalid|unexpected|format|wav|decoder)/i);
  });

  it('should error when provided empty audio file path @allure.id:8960', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    const { output, errorOutput, exitCode } = await runExample(
      script,
      ['--audioFilePath='],
      { allowAnyNonZeroExit: true },
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('speech_to_text.ts');
    expect(errorOutput).toContain('You need to provide a audioFilePath.');
    expect(errorOutput).toContain('Usage:');
  });

  it('should handle audio file with relative path @allure.id:8969', async () => {
    await allure.suite('Tests for speech_to_text.ts template');

    // Use relative path from the CLI directory
    const relativePath = './__tests__/fixtures/stt/audio.wav';

    const { output, errorOutput, exitCode } = await runExample(script, [
      `--audioFilePath=${relativePath}`,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    expect(output).toMatch(/Result count: \d+/);
    expect(output).toMatch(/Result: .+/);
    expect(output).toContain('How can I assist you today');
  }, 60000);
});
