import * as allure from 'allure-js-commons';

import { basicNerTestData } from '../fixtures';
import { checkCommandOutput } from './helpers/check-command-output';
import { runExample } from './helpers/run-example';

describe('Check basic_ner.ts', () => {
  const script = 'basic-ner';

  it('should extract entities from text successfully @allure.id:5712', async () => {
    await allure.suite('Tests for basic_ner.ts template');
    const { output, errorOutput, exitCode } = await runExample(script, []);

    // Check that the output contains the header
    expect(output).toContain('=== Simple Entity Extraction Example ===');

    // Check each test case individually to avoid issues with C++ debug output
    for (const testData of basicNerTestData) {
      expect(output).toContain(`Analyzing: "${testData.text}"`);
      expect(output).toContain(`Found ${testData.entities.length} entities:`);

      // Check each entity
      for (const entity of testData.entities) {
        expect(output).toContain(`- ${entity.entityName}: "${entity.text}"`);
      }
    }

    checkCommandOutput(errorOutput, exitCode);
  }, 30000);
});
