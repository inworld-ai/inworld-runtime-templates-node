import * as allure from 'allure-js-commons';

import { checkCommandOutputDetailed } from '../helpers/check-command-output-detailed';
import { runExample } from '../helpers/run-example';

function checkKnowledgeOutput(output: string) {
  expect(output).toContain('✅ Graph configuration validation passed.');
  expect(output).toContain('Initial knowledge:');
  expect(output).toContain('Retrieved knowledge:');

  // Check that initial knowledge records are displayed
  expect(output).toContain('[0]: The Olympics are staged every four years.');
  expect(output).toContain(
    '[1]: Our solar system includes the Sun, eight planets',
  );
  expect(output).toContain(
    '[2]: Nightingales have an astonishingly rich repertoire',
  );
}

function checkKnowledgeRetrievedRecords(
  output: string,
  expectedRecords: string[],
) {
  const retrievedSection = output.substring(
    output.indexOf('Retrieved knowledge:'),
  );

  expectedRecords.forEach((record) => {
    expect(retrievedSection).toContain(record);
  });
}

describe('node_knowledge.ts', () => {
  const script = 'node-knowledge';

  it('should run with default usage example from template @allure.id:8060', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    // Using the exact example from the usage
    const { output, errorOutput, exitCode } = await runExample(script, [
      'How often are the Olympics held?',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should retrieve Olympics-related knowledge
    checkKnowledgeRetrievedRecords(output, [
      'The Olympics are staged every four years',
    ]);
  });

  it('should answer question about solar system facts @allure.id:8051', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'How many planets are in our solar system?',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should retrieve solar system knowledge
    checkKnowledgeRetrievedRecords(output, [
      'Our solar system includes the Sun, eight planets',
    ]);
  });

  it('should answer question about birds and sounds @allure.id:8057', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'How many sounds can nightingales make?',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should retrieve nightingale knowledge
    checkKnowledgeRetrievedRecords(output, [
      'Nightingales have an astonishingly rich repertoire, able to produce over 1000 different sounds',
    ]);
  });

  it('should handle questions not related to any knowledge fact @allure.id:8061', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'What is the capital of France?',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // For unrelated queries, it might return empty or no matching records
    // The system should still work but might not find relevant knowledge
    expect(output).toContain('Retrieved knowledge:');
  });

  it('should handle questions about weather (unrelated topic) @allure.id:8058', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'What is the weather like today?',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should complete successfully even with unrelated query
    expect(output).toContain('Retrieved knowledge:');
  });

  it('should use default query when no arguments provided @allure.id:8053', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, []);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should use the default Olympics query
    checkKnowledgeRetrievedRecords(output, [
      'The Olympics are staged every four years',
    ]);
  });

  it('should handle multi-word queries correctly @allure.id:8052', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'Tell me about the Olympic games and how frequently they occur',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should retrieve Olympics knowledge for multi-word query
    checkKnowledgeRetrievedRecords(output, [
      'The Olympics are staged every four years',
    ]);
  });

  it('should handle empty string query @allure.id:8982', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, ['']);

    // Empty query should fall back to default query and work normally
    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    checkKnowledgeRetrievedRecords(output, [
      'The Olympics are staged every four years',
    ]);
  });

  it('should handle very long query @allure.id:8979', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const longQuery =
      'This is a very long query about Olympics and sports and games that happen every few years and involve many countries and athletes from around the world competing in various disciplines and events seeking medals and recognition for their achievements in their respective sports and representing their nations with pride and honor on the international stage';

    const { output, errorOutput, exitCode } = await runExample(script, [
      longQuery,
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should still work with long queries
    expect(output).toContain('Retrieved knowledge:');
  });

  it('should handle queries with punctuation and numbers @allure.id:8981', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'Olympics games: how often? every 4 years!',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should handle punctuation gracefully
    expect(output).toContain('Retrieved knowledge:');
  });

  it('should handle queries with hyphens and quotes @allure.id:8980', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      'Tell me about night-singing birds',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);
    checkKnowledgeOutput(output);

    // Should handle hyphens gracefully
    expect(output).toContain('Retrieved knowledge:');
  });

  it('should show help when --help flag is provided @allure.id:8978', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const { output, errorOutput, exitCode } = await runExample(script, [
      '--help',
    ]);

    checkCommandOutputDetailed(errorOutput, exitCode, output);

    // Check for usage information
    expect(output).toContain('Usage:');
    expect(output).toContain('npm run node-knowledge');
    expect(output).toContain('How often are the Olympics held?');
    expect(output).toContain(
      'INWORLD_API_KEY environment variable must be set',
    );
  });

  it('should find partial matches for Olympic variations @allure.id:8961', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const variations = [
      'Olympics',
      'Olympic games',
      'Olympic events',
      'four years Olympics',
    ];

    for (const query of variations) {
      const { output, errorOutput, exitCode } = await runExample(script, [
        query,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkKnowledgeOutput(output);

      // Each variation should potentially find Olympics knowledge
      expect(output).toContain('Retrieved knowledge:');
    }
  }, 60000);

  it('should handle queries about planets and space @allure.id:8958', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const spaceQueries = [
      'planets in solar system',
      'how many planets',
      'sun and planets',
      'solar system composition',
    ];

    for (const query of spaceQueries) {
      const { output, errorOutput, exitCode } = await runExample(script, [
        query,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkKnowledgeOutput(output);

      expect(output).toContain('Retrieved knowledge:');
    }
  }, 60000);

  it('should handle queries about birds and sounds @allure.id:8955', async () => {
    await allure.suite('Tests for node_knowledge.ts template');

    const birdQueries = [
      'nightingale sounds',
      'bird repertoire',
      'skylark sounds',
      'blackbird sounds',
      '1000 sounds',
    ];

    for (const query of birdQueries) {
      const { output, errorOutput, exitCode } = await runExample(script, [
        query,
      ]);

      checkCommandOutputDetailed(errorOutput, exitCode, output);
      checkKnowledgeOutput(output);

      expect(output).toContain('Retrieved knowledge:');
    }
  }, 60000);
});
