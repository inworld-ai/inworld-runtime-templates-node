import { expect } from '@jest/globals';

import { basicSafetyTestData, customSafetyTestCase } from '../../fixtures';

/**
 * Checks if a confidence value is a valid float number
 */
function checkConfidenceIsFloat(output: string, category: string): void {
  // Extract the confidence value using regex
  const regex = new RegExp(` - ${category} \\(confidence: (\\d+\\.\\d+)\\)`);
  const match = output.match(regex);

  // Check that we have a match
  expect(match).not.toBeNull();

  // Extract the confidence value and convert to number
  const confidenceValue = match ? parseFloat(match[1]) : NaN;

  // Verify it's a valid float number
  expect(isNaN(confidenceValue)).toBe(false);
  expect(confidenceValue).toBeGreaterThan(0.5);
  expect(confidenceValue).toBeLessThan(1);
}

export function checkSafetyOutput(output: string) {
  const meaningfulOutput = output
    .split('Checking safety with default thresholds:')
    .slice(1)[0]
    .split('---');
  const outputBlocks = meaningfulOutput;
  expect(outputBlocks.length).toBe(basicSafetyTestData.length + 1);
  for (const testData of basicSafetyTestData) {
    const outputBlock = outputBlocks.find((block) =>
      block.includes(`Input: "${testData.text}"`),
    );
    expect(outputBlock).toBeDefined();
    if (outputBlock) {
      expect(outputBlock).toContain(`Is safe: ${testData.isSafe}`);
      if (!testData.isSafe) {
        expect(outputBlock).toContain('Detected topics:');
        for (const category of testData.detectedCategories ?? []) {
          expect(outputBlock).toMatch(` - ${category} (confidence: `);
          checkConfidenceIsFloat(outputBlock, category);
        }
      }
    }
  }
  const customOutput = outputBlocks
    .slice(-1)[0]
    .split('\n')
    .filter((line) => line.trim() !== '');
  expect(customOutput[0]).toBe('Checking safety with custom thresholds:');
  expect(customOutput[1]).toBe(`Input: "${customSafetyTestCase.text}"`);
  expect(customOutput[2]).toBe(`Is safe: ${customSafetyTestCase.isSafe}`);
  if (!customSafetyTestCase.isSafe) {
    expect(customOutput[3]).toContain('Detected topics:');
    for (const category of customSafetyTestCase.detectedCategories ?? []) {
      expect(customOutput[4]).toMatch(` - ${category} (confidence: `);
      checkConfidenceIsFloat(customOutput[4], category);
    }
  }
}
