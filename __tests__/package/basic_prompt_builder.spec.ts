import * as allure from 'allure-js-commons';
import * as os from 'os';
import * as path from 'path';

import { defaultRenderedPrompt } from '../fixtures/templates/default_rendered_prompt';
import { checkCommandOutput } from './helpers/check-command-output';
import { runExample } from './helpers/run-example';

// Normalize strings for comparison - only used on Windows
function normalizeString(str: string): string {
  return str
    .replace(/·/g, '') // Remove special dot characters
    .replace(/\r\n/g, '\n') // Convert Windows line endings to Unix
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim(); // Remove leading/trailing whitespace
}

// Platform-aware string comparison helper
function expectOutputToContainPrompt(
  output: string,
  expectedPrompt: string,
): void {
  const isWindows = os.platform() === 'win32';

  if (isWindows) {
    // On Windows, normalize both strings before comparison
    const normalizedOutput = normalizeString(output);
    const normalizedExpected = normalizeString(expectedPrompt);
    expect(normalizedOutput).toContain(normalizedExpected);
  } else {
    // On non-Windows platforms, do the regular comparison
    expect(output).toContain(expectedPrompt);
  }
}

describe('basic_prompt_builder.ts', () => {
  const script = 'basic-prompt-builder';

  it('should render simple greeting template @allure.id:5698', async () => {
    await allure.suite('Tests for basic_prompt_builder.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=simple',
    ]);

    expect(output).toContain('Simple Greeting Example');
    expect(output).toContain('Hello Alice! Welcome to Wonderland.');
    expect(output).toContain('Hello Bob! Welcome to the Matrix.');
    expect(output).toContain('Hello Charlie! Welcome to Narnia.');

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
  }, 30000);

  it('should render complex templates with conditionals and loops @allure.id:5699', async () => {
    await allure.suite('Tests for basic_prompt_builder.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=complex',
    ]);

    expect(output).toContain('Complex Template Examples');

    // Check conditional template
    expect(output).toContain('Conditional Template');
    expect(output).toContain('Welcome back, premium member Alice!');
    expect(output).toContain('Welcome Bob!');
    expect(output).toContain('Consider upgrading to premium');

    // Check loop template
    expect(output).toContain('Loop Template');
    expect(output).toContain('Shopping Cart for Charlie');
    expect(output).toContain('Apple');
    expect(output).toContain('Banana');
    expect(output).toContain('Orange');

    // Check AI character prompt
    expect(output).toContain('AI Character Prompt');
    expect(output).toContain('RoboAssistant');
    expect(output).toContain('helpful AI assistant specialized in coding');
    expect(output).toContain('Patient');
    expect(output).toContain('async/await');

    // Check filters
    expect(output).toContain('Template with Filters');
    expect(output).toContain('ACME CORP');
    expect(output).toContain('Success');

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
  }, 30000);

  it('should validate templates correctly @allure.id:5700', async () => {
    await allure.suite('Tests for basic_prompt_builder.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=validation',
    ]);

    expect(output).toContain('Template Validation Example');

    // Check valid case
    expect(output).toContain('Test 1: All variables provided');
    expect(output).toContain('Valid: true');
    expect(output).toContain('Hello Alice! You are 30 years old');

    // Check missing variable case
    expect(output).toContain('Test 2: Missing required variable');

    // Check extra variables case
    expect(output).toContain('Test 3: Extra variables');
    expect(output).toContain('Hello Charlie! You are 35 years old');

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
  }, 30000);

  it('should render file-based template with default files @allure.id:5701', async () => {
    await allure.suite('Tests for basic_prompt_builder.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=file',
    ]);

    expect(output).toContain('File-based Template Example');
    expect(output).toContain('Rendered Prompt:');
    expectOutputToContainPrompt(output, defaultRenderedPrompt.trim());

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
  }, 30000);

  it('should render file-based template with custom files @allure.id:5702', async () => {
    await allure.suite('Tests for basic_prompt_builder.ts template');
    const templatePath = path.resolve(
      __dirname,
      '../fixtures/prompts/user_prompt.jinja',
    );
    const variablesPath = path.resolve(
      __dirname,
      '../fixtures/prompts/user_prompt_props.json',
    );

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=file',
      `--template=${templatePath}`,
      `--variables=${variablesPath}`,
    ]);

    expect(output).toContain('File-based Template Example');
    expect(output).toContain('Rendered Prompt:');
    expectOutputToContainPrompt(output, defaultRenderedPrompt.trim());

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
  }, 30000);
});
