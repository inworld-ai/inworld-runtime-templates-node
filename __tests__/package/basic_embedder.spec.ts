import * as allure from 'allure-js-commons';

import { embeddingsTestData, remoteEmbeddingsModels } from '../fixtures';
import { checkCommandOutput } from './helpers/check-command-output';
import { generateEmbedderOutput } from './helpers/generate-embedder-output';
import { runExample } from './helpers/run-example';

describe('basic_embedder.ts', () => {
  const script = 'basic-embedder';

  it('should generate embeddings with remote mode and default parameters @allure.id:5705', async () => {
    await allure.suite('Tests for basic_embedder.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, []);

    const expectedOutput = generateEmbedderOutput(embeddingsTestData);
    expect(output).toContain(expectedOutput);
    checkCommandOutput(errorOutput, exitCode);
  });

  for (const model of remoteEmbeddingsModels) {
    it(`should generate embeddings with remote mode and specified model name ${model.name}`, async () => {
      await allure.suite('Tests for basic_embedder.ts template');
      const { output, errorOutput, exitCode } = await runExample(script, [
        '--mode=remote',
        `--modelName=${model.name}`,
        '--provider=inworld',
      ]);

      const expectedOutput = generateEmbedderOutput(
        embeddingsTestData,
        model.dimension,
      );
      expect(output).toContain(expectedOutput);
      checkCommandOutput(errorOutput, exitCode);
    });

    it(`should generate embeddings with specified model ${model.name} only`, async () => {
      await allure.suite('Tests for basic_embedder.ts template');
      const { output, errorOutput, exitCode } = await runExample(script, [
        `--modelName=${model.name}`,
      ]);

      const expectedOutput = generateEmbedderOutput(
        embeddingsTestData,
        model.dimension,
      );
      expect(output).toContain(expectedOutput);
      checkCommandOutput(errorOutput, exitCode);
    });
  }

  // New tests for the unified factory pattern
  it('should work with unified createTextEmbedder method for remote mode', async () => {
    await allure.suite('Tests for unified factory pattern');
    const { output, errorOutput, exitCode } = await runExample(script, [
      '--mode=remote',
      '--modelName=BAAI/bge-large-en-v1.5',
      '--provider=inworld',
    ]);

    const expectedOutput = generateEmbedderOutput(embeddingsTestData, 1024);
    expect(output).toContain(expectedOutput);
    checkCommandOutput(errorOutput, exitCode);
  });
});
