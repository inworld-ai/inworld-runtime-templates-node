/**
 * Checks if knowledge output contains or doesn't contain the expected items
 *
 * @param output The command output to check
 * @param expectContains Items that should be in the output (string, array, or null)
 * @param expectNotContains Items that should not be in the output (string, array, or null)
 */
export function checkKnowledgeContent(
  output: string,
  expectContains: string | string[] | null,
  expectNotContains: string | string[] | null,
): void {
  // Check for items that should be present
  if (expectContains !== null) {
    if (Array.isArray(expectContains)) {
      // Check each item in the array
      for (const item of expectContains) {
        expect(output).toContain(item);
      }
    } else {
      // Check a single string
      expect(output).toContain(expectContains);
    }
  }

  // Check for items that should not be present
  if (expectNotContains !== null) {
    if (Array.isArray(expectNotContains)) {
      // Check each item in the array
      for (const item of expectNotContains) {
        expect(output).not.toContain(item);
      }
    } else {
      // Check a single string
      expect(output).not.toContain(expectNotContains);
    }
  }
}
