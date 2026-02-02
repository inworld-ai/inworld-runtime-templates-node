import * as allure from 'allure-js-commons';
import * as path from 'path';

import { checkCommandOutput } from '../helpers/check-command-output';
import { runExample } from '../helpers/run-example';

function checkCustomJinjaOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('Rendered Jinja Template:');
  expect(output).toContain('## Profile of FusionBot');
  expect(output).toContain('Name: FusionBot');
  expect(output).toContain(
    'Description: A friendly and fun robot designed to save the Earth from a meteorite.',
  );
  expect(output).toContain(
    'Long-term motivation: Keep people of Earth safe from meteorites and other space threats.',
  );
  expect(output).toContain('## Conversation history:');
  expect(output).toContain(
    "FusionBot: Hello, Earthlings! I am FusionBot, your friendly robot here to save the planet from meteorites. Let's work together to keep our home safe!",
  );
  expect(output).toContain('## Instructions:');
  expect(output).toContain(
    "- Respond naturally taking into account the conversation history, don't repeat the same information, just continue the conversation.",
  );
  expect(output).toContain('- If someone ask you a question, answer it.');
  expect(output).toContain(
    '- Please return only the text of your response, without any additional information.',
  );
  expect(output).toContain("## FusionBot's response:");
  expect(output).toContain('FusionBot:');
}

describe('custom_jinja.ts', () => {
  const script = 'node-custom-jinja';

  it('should render Jinja template with default parameters @allure.id:9019', async () => {
    await allure.suite('Tests for custom_jinja.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkCustomJinjaOutput(output);

    // Check for default file usage warnings (they might be in stderr)
    const allOutput = output + errorOutput;
    expect(allOutput).toContain('using default prompt file');
    expect(allOutput).toContain('using default promptProps file');
  });

  it('should render Jinja template with provided --prompt only @allure.id:9017', async () => {
    await allure.suite('Tests for custom_jinja.ts template');

    const promptPath = path.resolve(
      __dirname,
      '../../../src/shared/prompts/basic_prompt.jinja',
    );
    const { output, errorOutput, exitCode } = await runExample(script, [
      `--prompt=${promptPath}`,
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkCustomJinjaOutput(output);

    // Should only warn about default promptProps, not prompt
    const allOutput = output + errorOutput;
    expect(allOutput).not.toContain('using default prompt file');
    expect(allOutput).toContain('using default promptProps file');
  });

  it('should render Jinja template with provided --promptProps only @allure.id:9018', async () => {
    await allure.suite('Tests for custom_jinja.ts template');

    const promptPropsPath = path.resolve(
      __dirname,
      '../../../src/shared/prompts/basic_prompt_props.json',
    );
    const { output, errorOutput, exitCode } = await runExample(script, [
      `--promptProps=${promptPropsPath}`,
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkCustomJinjaOutput(output);

    // Should only warn about default prompt, not promptProps
    const allOutput = output + errorOutput;
    expect(allOutput).toContain('using default prompt file');
    expect(allOutput).not.toContain('using default promptProps file');
  });

  it('should render Jinja template with both --prompt and --promptProps provided @allure.id:9016', async () => {
    await allure.suite('Tests for custom_jinja.ts template');

    const promptPath = path.resolve(
      __dirname,
      '../../../src/shared/prompts/basic_prompt.jinja',
    );
    const promptPropsPath = path.resolve(
      __dirname,
      '../../../src/shared/prompts/basic_prompt_props.json',
    );
    const { output, errorOutput, exitCode } = await runExample(script, [
      `--prompt=${promptPath}`,
      `--promptProps=${promptPropsPath}`,
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);
    checkCustomJinjaOutput(output);

    // Should not warn about any default files
    const allOutput = output + errorOutput;
    expect(allOutput).not.toContain('using default prompt file');
    expect(allOutput).not.toContain('using default promptProps file');
  });

  it('should show help when --help flag is provided @allure.id:9015', async () => {
    await allure.suite('Tests for custom_jinja.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    expect(exitCode).toBe(0);
    checkCommandOutput(errorOutput, exitCode);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-custom-jinja');
    expect(output).toContain('Description:');
    expect(output).toContain(
      'demonstrates how to create a custom node that renders a Jinja template',
    );
    expect(output).toContain('--prompt=');
    expect(output).toContain('--promptProps=');
  });
});
