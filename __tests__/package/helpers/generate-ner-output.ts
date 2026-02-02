/**
 * Generate expected output string for basic_ner tests
 * @returns Formatted string matching the expected output
 */
export function generateNerOutput(nerTestData: any[]): string {
  const outputLines: string[] = ['=== Simple Entity Extraction Example ==='];

  for (const testData of nerTestData) {
    const { text, entities } = testData;
    outputLines.push(`Analyzing: "${text}"`);
    outputLines.push(`  Found ${entities.length} entities:`);
    for (const entity of entities) {
      // The output includes position markers like [0-10], we match just entityName and text
      outputLines.push(`    - ${entity.entityName}: "${entity.text}"`);
    }
  }

  return outputLines.join('\n');
}
