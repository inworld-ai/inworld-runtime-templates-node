import * as allure from 'allure-js-commons';
import * as path from 'path';

import { runExample } from './helpers/run-example';

// Templates excluded from package distribution
const EXCLUDED_FROM_PACKAGE: string[] = [];

const graphTemplatesWithArgs: Record<string, string[]> = {
  'node-llm-chat': ['"Hello, how are you?"'],
  'node-llm-chat-explicit-component': ['"What is 2 + 2?"'],
  'node-llm-completion': ['"Hello, how"'],
  'node-stt': [
    `--audioFilePath=${path.resolve(__dirname, '../fixtures/stt/audio.wav')}`,
  ],
  'node-tts': ['"Hello, this is a test message"'],
  'node-intent': ['"I want to book a flight"'],
  'node-text-chunking-and-aggregator': [
    '"This is a test message for text chunking and aggregation. It should be long enough to demonstrate the functionality."',
  ],
  'node-random-canned': ['"Tell me a joke"'],
  'node-proxy': ['"Hello, how are you?"', '--inputType=text'],
  'node-subgraph': ['"Test subgraph functionality"'],
  'node-custom-jinja': [], // Uses default template files
  'node-custom-reverse': ['"Hello, world"'],
  'node-custom-llm-stream': ['"Hello, world"'],
  'node-custom-tts-stream': ['"Hello, how are you?"'],
  'node-custom-tts': ['"Hello, how are you?"', '--voiceName=Erik'],
  'node-custom-advanced': ['"Hello, world!"'],
  'conditional-edges-after-intent': ['"Hello"'],
  'conditional-edges-after-llm': [], // No arguments needed
  'conditional-edges-after-knowledge': ['"What is the capital of France?"'],
  'model-selector-conditional': ['"Hello, how are you?"'],
};

/**
 * Just check that the template completed successfully with exitCode 0.
 *
 */
describe('Graph Templates', () => {
  beforeAll(() => {
    jest.retryTimes(3);
  });

  Object.entries(graphTemplatesWithArgs).forEach(([templateName, args]) => {
    const isPackageMode = process.env.PACKAGE_TEMPLATES_ONLY === 'true';
    const shouldSkip =
      isPackageMode && EXCLUDED_FROM_PACKAGE.includes(templateName);

    const testFunction = shouldSkip ? it.skip : it;

    testFunction(
      `should run ${templateName} successfully @allure.id:${getAllureId(
        templateName,
      )}`,
      async () => {
        await allure.suite('Graph Templates Tests');
        await allure.feature('Template Execution');
        await allure.story(templateName);

        try {
          const { output, errorOutput, exitCode } = await runExample(
            templateName,
            args,
          );

          console.log('errorOutput:', errorOutput);

          expect(exitCode).toBe(0);

          console.log(`✅ ${templateName} completed successfully`);

          console.log(`   Args: ${args.join(' ')}`);

          if (output.trim()) {
            console.log(
              `   Output: ${output.trim().substring(0, 100)}${
                output.length > 100 ? '...' : ''
              }`,
            );
          }
        } catch (error) {
          console.error(`❌ ${templateName} failed:`, error);
          throw error;
        }
      },
      60000,
    );
  });
});

function getAllureId(templateName: string): number {
  const idMap: Record<string, number> = {
    'node-llm-chat': 7537,
    'node-llm-chat-advanced': 7535,
    'node-llm-chat-explicit-component': 7533,
    'node-llm-completion': 7519,
    'node-stt': 7530,
    'node-tts': 7523,
    'node-intent': 7517,
    'node-text-chunking-and-aggregator': 7532,
    'node-knowledge': 7529,
    'node-random-canned': 7525,
    'node-proxy': 7536,
    'node-subgraph': 7534,
    'node-custom-jinja': 7524,
    'node-custom-reverse': 7518,
    'node-custom-llm-stream': 7520,
    'node-custom-tts-stream': 7528,
    'node-custom-response-processing': 7522,
    'node-custom-text-to-text-stream': 7526,
    'node-custom-tts': 7521,
    'node-custom-advanced': 7531,
    'user-context': 7527,
    'conditional-edges-after-intent': 7540,
    'conditional-edges-after-llm': 7541,
    'conditional-edges-after-knowledge': 7539,
    'model-selector-conditional': 8928,
  };

  return idMap[templateName] || 6000;
}
