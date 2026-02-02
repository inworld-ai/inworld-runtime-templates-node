/**
 * Checks the output of a command execution for errors and warnings
 * @param errorOutput The error output string to check
 * @param exitCode The exit code of the command
 * @param maxWarnings Maximum number of warnings allowed (default: 1)
 */
export function checkCommandOutput(
  errorOutput: string,
  exitCode: number,
  maxWarnings: number = 1,
): void {
  // Check exit code is 0 (success)
  expect(exitCode).toBe(0);

  // Check no errors in output
  expect(errorOutput).not.toMatch(/error/i);

  // Check warnings don't exceed max
  const warningMatches = errorOutput.match(/warning/gi);
  expect(warningMatches?.length || 0).toBeLessThanOrEqual(maxWarnings);
}
