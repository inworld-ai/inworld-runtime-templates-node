/**
 * Voice Activity Detection (VAD) Example
 *
 * This example demonstrates the VAD primitive for detecting speech and silence in audio:
 * - Voice activity detection (returns sample index where speech starts)
 * - Silence detection (returns intervals of silence)
 * - Configurable speech thresholds
 * - Device selection (CPU, CUDA, etc.)
 *
 * Usage:
 *   npm run basic-vad --audioFilePath=<path-to-audio.wav> [--mode=simple|silence|threshold|device]
 *
 * Modes:
 *   - simple: Basic voice activity detection (default)
 *   - silence: Detect silence intervals in audio
 *   - threshold: Test different speech threshold values
 *   - device: Show available devices and use CUDA if available
 */

import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { DeviceRegistry } from '@inworld/runtime/core';
import { DeviceType } from '@inworld/runtime/core';
import { VAD } from '@inworld/runtime/primitives/vad';
import * as fs from 'fs';

import { DEFAULT_VAD_MODEL_PATH } from '../shared/constants';

const minimist = require('minimist');
const WavDecoder = require('wav-decoder');

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

const usage = `
Voice Activity Detection (VAD) Example

Usage:
    npm run basic-vad -- --audioFilePath=<path-to-audio.wav> [options]

Required:
    --audioFilePath=<path>    Path to audio file (WAV format)

Optional:
    --mode=<mode>             Mode to run:
                              - simple: Basic voice activity detection (default)
                              - silence: Detect silence intervals
                              - threshold: Test different threshold values
                              - device: Show device selection
    --modelPath=<path>        Path to VAD model (default: ./shared/models/silero_vad.onnx)
    --speechThreshold=<num>   Speech threshold (0.0-1.0, default: 0.5)
    --help                    Show this help message

Examples:
    npm run basic-vad -- --audioFilePath=audio.wav
    npm run basic-vad -- --audioFilePath=audio.wav --mode=silence
    npm run basic-vad -- --audioFilePath=audio.wav --mode=threshold
    npm run basic-vad -- --audioFilePath=audio.wav --mode=device
`;

interface Args {
  audioFilePath: string;
  modelPath: string;
  mode: string;
  speechThreshold: number;
}

function parseArgs(): Args {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const audioFilePath = argv.audioFilePath || '';
  const modelPath = argv.modelPath || DEFAULT_VAD_MODEL_PATH;
  const mode = argv.mode || 'simple';
  const speechThreshold = parseFloat(argv.speechThreshold) || 0.5;

  if (!audioFilePath) {
    throw new Error(`Missing required argument: --audioFilePath\n${usage}`);
  }

  if (!fs.existsSync(audioFilePath)) {
    throw new Error(`Audio file not found: ${audioFilePath}`);
  }

  if (!fs.existsSync(modelPath)) {
    throw new Error(`VAD model not found: ${modelPath}`);
  }

  const validModes = ['simple', 'silence', 'threshold', 'device'];
  if (!validModes.includes(mode)) {
    throw new Error(
      `Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`,
    );
  }

  return { audioFilePath, modelPath, mode, speechThreshold };
}

// ============================================================================
// Audio Loading
// ============================================================================

interface AudioData {
  data: Float32Array<ArrayBuffer>;
  sampleRate: number;
  duration: number;
}

async function loadAudioFile(filePath: string): Promise<AudioData> {
  const audioBuffer = fs.readFileSync(filePath);
  const decoded = await WavDecoder.decode(audioBuffer);

  // Use first channel and ensure it's a properly typed Float32Array<ArrayBuffer>
  const channelData = decoded.channelData[0];
  const data = new Float32Array(channelData) as Float32Array<ArrayBuffer>;
  const sampleRate = decoded.sampleRate;
  const duration = data.length / sampleRate;

  return { data, sampleRate, duration };
}

// ============================================================================
// Example 1: Simple Voice Activity Detection
// ============================================================================

async function runSimpleExample(
  audioData: AudioData,
  modelPath: string,
  speechThreshold: number,
): Promise<void> {
  console.log('=== Simple Voice Activity Detection Example ===\n');

  console.log('Audio Information:');
  console.log(`  Sample Rate: ${audioData.sampleRate} Hz`);
  console.log(`  Duration: ${audioData.duration.toFixed(2)} seconds`);
  console.log(`  Total Samples: ${audioData.data.length}`);
  console.log();

  // Create VAD instance
  const vad = await VAD.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { speechThreshold },
    },
  });

  console.log('Detecting voice activity...');
  console.log(`  Speech Threshold: ${speechThreshold}`);
  console.log();

  // Detect voice activity
  const result = await vad.detectVoiceActivity({
    data: Buffer.from(audioData.data),
    sampleRate: audioData.sampleRate,
  });

  console.log('Result:', result);

  if (result === -1) {
    console.log('  Status: No speech detected');
  } else {
    const timeSeconds = result / audioData.sampleRate;
    console.log(`  Status: Speech detected at sample ${result}`);
    console.log(`  Time: ${timeSeconds.toFixed(3)} seconds`);
  }
}

// ============================================================================
// Example 2: Silence Detection
// ============================================================================

async function runSilenceExample(
  audioData: AudioData,
  modelPath: string,
  speechThreshold: number,
): Promise<void> {
  console.log('=== Silence Detection Example ===\n');

  console.log('Audio Information:');
  console.log(`  Sample Rate: ${audioData.sampleRate} Hz`);
  console.log(`  Duration: ${audioData.duration.toFixed(2)} seconds`);
  console.log(`  Total Samples: ${audioData.data.length}`);
  console.log();

  // Create VAD instance
  const vad = await VAD.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { speechThreshold },
    },
  });

  console.log('Detecting silence intervals...');
  console.log(`  Speech Threshold: ${speechThreshold}`);
  console.log();

  // Convert Float32Array to Buffer for silence detection
  const audioBuffer = Buffer.from(audioData.data.buffer);

  // Detect silence intervals
  const silenceIntervals = await vad.detectSilence(
    audioBuffer,
    audioData.sampleRate,
  );

  console.log(`Found ${silenceIntervals.length} silence intervals:`);
  if (silenceIntervals.length === 0) {
    console.log('  No silence detected');
  } else {
    silenceIntervals.forEach((interval, index) => {
      const startTime = (interval.start / audioData.sampleRate).toFixed(3);
      const endTime = (interval.end / audioData.sampleRate).toFixed(3);
      const duration = (
        (interval.end - interval.start) /
        audioData.sampleRate
      ).toFixed(3);

      console.log(
        `  ${index + 1}. Samples [${interval.start}-${interval.end}] (${startTime}s - ${endTime}s, duration: ${duration}s)`,
      );
    });
  }
}

// ============================================================================
// Example 3: Threshold Comparison
// ============================================================================

async function runThresholdExample(
  audioData: AudioData,
  modelPath: string,
): Promise<void> {
  console.log('=== Speech Threshold Comparison Example ===\n');

  console.log('Testing different speech thresholds...');
  console.log(
    'Lower thresholds are more sensitive (detect speech more easily)',
  );
  console.log(
    'Higher thresholds are less sensitive (require stronger speech signals)',
  );
  console.log();

  const thresholds = [0.3, 0.5, 0.7, 0.9];

  for (const threshold of thresholds) {
    console.log(`Threshold: ${threshold}`);

    const vad = await VAD.create({
      localConfig: {
        modelPath,
        device: { type: DeviceType.CPU, index: 0 },
        defaultConfig: { speechThreshold: threshold },
      },
    });

    const result = await vad.detectVoiceActivity({
      data: Buffer.from(audioData.data),
      sampleRate: audioData.sampleRate,
    });

    if (result === -1) {
      console.log('  Result: No speech detected');
    } else {
      const timeSeconds = result / audioData.sampleRate;
      console.log(
        `  Result: Speech at sample ${result} (${timeSeconds.toFixed(3)}s)`,
      );
    }
    console.log();
  }
}

// ============================================================================
// Example 4: Device Selection
// ============================================================================

async function runDeviceExample(
  audioData: AudioData,
  modelPath: string,
  speechThreshold: number,
): Promise<void> {
  console.log('=== Device Selection Example ===\n');

  // Get available devices
  const devices = await DeviceRegistry.getAvailableDevices();

  console.log(`Available Devices (${devices.length}):`);
  devices.forEach((device, index) => {
    console.log(`  ${index + 1}. ${device.type} ${device.index}`);
    if (device.info) {
      console.log(`     Name: ${device.info.name}`);
      const freeMB = (
        (Number(device.info.freeMemoryBytes) / 1024) *
        1024
      ).toFixed(2);
      const totalMB = (
        (Number(device.info.totalMemoryBytes) / 1024) *
        1024
      ).toFixed(2);
      console.log(`     Memory: ${freeMB} MB free / ${totalMB} MB total`);
    }
  });
  console.log();

  // Try to use CUDA if available, otherwise use CPU
  const cudaDevice = devices.find((d) => d.type === DeviceType.CUDA);
  const selectedDevice = cudaDevice || { type: DeviceType.CPU, index: 0 };

  console.log(
    `Selected Device: ${selectedDevice.type} ${selectedDevice.index}`,
  );
  console.log();

  // Create VAD instance with selected device
  const vad = await VAD.create({
    localConfig: {
      modelPath,
      device: selectedDevice,
      defaultConfig: { speechThreshold },
    },
  });

  console.log('Detecting voice activity...');
  const result = await vad.detectVoiceActivity({
    data: Buffer.from(audioData.data),
    sampleRate: audioData.sampleRate,
  });

  console.log('Result:', result);

  if (result === -1) {
    console.log('  Status: No speech detected');
  } else {
    const timeSeconds = result / audioData.sampleRate;
    console.log(`  Status: Speech detected at sample ${result}`);
    console.log(`  Time: ${timeSeconds.toFixed(3)} seconds`);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function run() {
  const { audioFilePath, modelPath, mode, speechThreshold } = parseArgs();

  // Load audio file
  const audioData = await loadAudioFile(audioFilePath);

  // Run the selected example
  switch (mode) {
    case 'simple':
      await runSimpleExample(audioData, modelPath, speechThreshold);
      break;
    case 'silence':
      await runSilenceExample(audioData, modelPath, speechThreshold);
      break;
    case 'threshold':
      await runThresholdExample(audioData, modelPath);
      break;
    case 'device':
      await runDeviceExample(audioData, modelPath, speechThreshold);
      break;
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }

  stopInworldRuntime();
}

// ============================================================================
// Error Handling & Process Management
// ============================================================================

function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error:', {
      message: err.message,
      context: err.context,
    });
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
});

// Run the example
run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
