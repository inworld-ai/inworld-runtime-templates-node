/**
 * Checks the output of a command execution for errors and warnings with detailed error reporting
 * @param errorOutput The error output string to check
 * @param exitCode The exit code of the command
 * @param output The standard output string (for additional context)
 * @param maxWarnings Maximum number of warnings allowed (default: 1)
 */
export function checkCommandOutputDetailed(
  errorOutput: string,
  exitCode: number,
  output: string = '',
  maxWarnings: number = 1,
): void {
  // Provide detailed error information if exit code is not 0
  if (exitCode !== 0) {
    let errorMessage = `Script failed with exit code ${exitCode}`;

    if (errorOutput) {
      errorMessage += `\n\nError Output:\n${errorOutput}`;
    }

    if (output) {
      // Include the last part of output for context
      const outputLines = output.split('\n');
      const lastLines = outputLines.slice(-10).join('\n'); // Last 10 lines
      errorMessage += `\n\nLast Output:\n${lastLines}`;
    }

    throw new Error(errorMessage);
  }

  // Check exit code is 0 (success)
  expect(exitCode).toBe(0);

  // Check no errors in output
  expect(errorOutput).not.toMatch(/error/i);

  // Check warnings don't exceed max
  const warningMatches = errorOutput.match(/warning/gi);
  expect(warningMatches?.length || 0).toBeLessThanOrEqual(maxWarnings);
}
