import { exec } from 'child_process';
import * as path from 'path';

interface RunResult {
  output: string;
  errorOutput: string;
  exitCode: number;
}

interface RunExampleOptions {
  /**
   * Exit codes that should be considered successful without logging errors.
   * Defaults to `[0]`.
   */
  allowedExitCodes?: number[];
  /**
   * When true, any non-zero exit code is treated as expected (useful for
   * negative tests asserting failures without caring about the exact code).
   */
  allowAnyNonZeroExit?: boolean;
}

/**
 * Converts file paths in arguments to absolute paths if they're not already
 * @param args Command line arguments to process
 * @returns Processed arguments with absolute paths
 */
function absolutizePaths(args: string[]): string[] {
  return args.map((arg) => {
    // Check if argument contains a file path
    const pathMatch = arg.match(/^(--\w+)=(.+)$/);
    if (!pathMatch) return arg;

    const [, paramName, paramValue] = pathMatch;
    // List of parameters that are expected to be file paths
    const pathParams = [
      '--modelPath',
      '--weightsPath',
      '--path',
      '--promptsPath',
      '--audioFilePath',
    ];

    if (
      pathParams.includes(paramName) &&
      paramValue &&
      typeof paramValue === 'string'
    ) {
      // Convert to absolute path if it's not already
      const absolutePath = path.isAbsolute(paramValue)
        ? paramValue
        : path.resolve(process.cwd(), paramValue);

      return `${paramName}=${absolutePath}`;
    }

    return arg;
  });
}

/**
 * Runs an example script with the given arguments using npm commands
 * @param {string} commandName - Name of the script command (e.g. 'basic-vad', 'basic-llm')
 * @param {string[]} args - Command line arguments to pass to the script
 * @param {RunExampleOptions} [options] - Execution overrides such as permitted exit codes
 * @returns {Promise<RunResult>} Promise that resolves to the script's output
 */
export function runExample(
  commandName: string,
  args: string[],
  options: RunExampleOptions = {},
): Promise<RunResult> {
  // The directory where the templates package.json is located
  const scriptDir = process.cwd();

  // Convert any file paths in args to absolute paths
  const processedArgs = absolutizePaths(args);

  // Use the exact command name as passed
  const npmCommand = commandName;

  // Use 'npm run <command>' format with args passed through exactly as provided
  const command = `npm run ${npmCommand} -- ${processedArgs.join(' ')}`;

  const { allowedExitCodes, allowAnyNonZeroExit } = options;

  return new Promise((resolve) => {
    // Execute the command with exec
    const child = exec(command, {
      env: {
        ...process.env,
        API_KEY: process.env.INWORLD_API_KEY || process.env.API_KEY,
        PATH: process.env.PATH,
        DISABLE_TELEMETRY: 'true',
        VERBOSITY: '2',
      },
      cwd: scriptDir,
      timeout: 60000, // 1 minute timeout
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('error', (error) => {
      errorOutput += `\nExecution error: ${error.message}`;
    });

    child.on('close', (code) => {
      const normalizedExitCode = code ?? 0;
      const expectedCodes = allowedExitCodes ?? [0];
      const isExpectedExit =
        expectedCodes.includes(normalizedExitCode) ||
        (!!allowAnyNonZeroExit && normalizedExitCode !== 0);

      resolve({ output, errorOutput, exitCode: normalizedExitCode });
      if (!isExpectedExit) {
        console.error(
          `Script failed with exit code ${normalizedExitCode}. Error output: ${errorOutput}`,
        );
      }
    });
  });
}
