/**
 * Streaming STT Example - Cloud and Local Modes
 *
 * This example demonstrates real-time speech-to-text transcription using
 * the StreamingSTT primitive with either cloud providers (AssemblyAI) or
 * local STT/VAD model files.
 *
 * Configuration values:
 * - Sample rate: 16000 Hz
 * - Frame size: 2048 samples (128ms chunks)
 * - Default silence threshold: 3000ms
 * - Cloud activity detection: endOfTurnConfidenceThreshold=0.5,
 *   minEndOfTurnSilenceWhenConfident=500ms, maxTurnSilence=2000ms
 */

import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { float32ToBytes, InworldError } from '@inworld/runtime/common';
import { DeviceType } from '@inworld/runtime/core';
import {
  type LocalStreamingSTTConfig,
  type RemoteStreamingSTTConfig,
  StreamingSTT,
  type StreamingSTTCreationConfig,
} from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

import {
  DEFAULT_LOCAL_STREAMING_VAD_MODEL_PATH,
  DEFAULT_STREAMING_STT_MODEL_ID,
  Modes,
} from '../shared/constants';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const usage = `
Streaming STT Example - Cloud and Local Modes

Usage:
  npm run basic-streaming-stt -- --mode=cloud
  npm run basic-streaming-stt -- --mode=local --sttModelPath=/path/to/local/stt/model

Options:
  --mode                  cloud|local (default: cloud)
  --model                 Cloud STT model ID (default: ${DEFAULT_STREAMING_STT_MODEL_ID})
  --providerConfig        Cloud provider config type: 'assemblyai' (default)
  --audioFile             Path to audio file (default: fixtures/stt/audio.wav)
  --silenceThreshold      Silence threshold in ms (default: 3000)
  --sttModelPath          Local STT model path (optional when auto-discovered)
  --vadModelPath          Local VAD model path (default: ${DEFAULT_LOCAL_STREAMING_VAD_MODEL_PATH})
  --help                  Show this help message

Available STT models:
  ${DEFAULT_STREAMING_STT_MODEL_ID}  (cloud default)
  assemblyai/u3-rt-pro
  inworld/inworld-stt-1

Environment:
  INWORLD_API_KEY         Required for cloud STT
  STREAMING_STT_LOCAL_MODEL_PATH  Optional default local STT model path
`;

const SILENCE_THRESHOLD_MS = 3000;
const ASSEMBLYAI_ACTIVITY_DETECTION = {
  endOfTurnConfidenceThreshold: 0.5,
  minEndOfTurnSilenceWhenConfidentMs: 500,
  maxTurnSilenceMs: 2000,
};
const LOCAL_MODELS_DIR = path.join(__dirname, '..', 'shared', 'models');
const LOCAL_STT_MODEL_ENV_VAR = 'STREAMING_STT_LOCAL_MODEL_PATH';
const NON_STT_MODEL_ENTRIES = new Set([
  'pipecat_smart_turn_v3.onnx',
  'silero_vad.onnx',
  'turn_detection',
]);
const CLOUD_MODE = 'cloud';
const VALID_MODES = [CLOUD_MODE, Modes.LOCAL] as const;
type StreamingSTTMode = (typeof VALID_MODES)[number];

run();

async function run() {
  const args = parseArgs();

  if (args.help) {
    console.log(usage);
    process.exit(0);
  }

  try {
    await runStreamingSTT(args);
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }

  stopInworldRuntime();
}

interface Args {
  mode: StreamingSTTMode;
  model: string;
  providerConfig: string;
  audioFile: string;
  silenceThreshold: number;
  sttModelPath: string;
  vadModelPath: string;
  apiKey: string;
  help: boolean;
}

/**
 * Main streaming STT function
 */
async function runStreamingSTT(args: Args): Promise<void> {
  validateArgs(args);
  const config = buildConfig(args);

  console.log('\n=== Streaming STT Example ===\n');
  if (args.mode === CLOUD_MODE) {
    console.log('Mode: Cloud (Remote)');
    console.log(`Provider: ${args.providerConfig || 'assemblyai'}`);
    console.log(`Model: ${args.model}`);
  } else {
    console.log('Mode: Local');
    console.log(`STT Model Path: ${args.sttModelPath}`);
    console.log(`VAD Model Path: ${args.vadModelPath}`);
  }
  console.log(`Silence Threshold: ${args.silenceThreshold}ms`);
  console.log(`Audio File: ${args.audioFile}\n`);

  console.log('Creating StreamingSTT client...');
  const sttClient = await StreamingSTT.create(config);
  console.log('StreamingSTT client created!\n');

  const audioData = await loadAudioFile(args.audioFile);
  console.log(
    `Loaded audio: ${audioData.duration.toFixed(2)}s @ ${audioData.sampleRate}Hz`,
  );

  // Simulate real-time with 100ms chunks and delays
  const chunkSize = Math.floor(audioData.sampleRate * 0.1); // 100ms chunks
  const trailingSilenceMs = resolveSilencePaddingMs(args.silenceThreshold);
  const audioStream = createRealtimeAudioStream(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
    100, // 100ms delay between chunks
    trailingSilenceMs,
  );

  console.log('\nStarting continuous streaming STT...');
  console.log('─'.repeat(60));

  const session = await sttClient.startRecognizeSpeechSession(audioStream);
  let lastTranscript = '';
  const startTime = Date.now();

  for await (const result of session) {
    if (result.text !== lastTranscript) {
      if (result.isFinal) {
        // Clear line and show final transcript
        process.stdout.write(`\r\x1b[K[FINAL] ${result.text}\n`);
      } else {
        // Show partial transcript
        process.stdout.write(`\r\x1b[K[partial] ${result.text}`);
      }
      lastTranscript = result.text;
    }
  }

  const elapsed = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('\nStreaming complete.');
  console.log(`  Processing time: ${elapsed}ms`);
  console.log(`  Audio duration: ${audioData.duration.toFixed(2)}s`);
  console.log(
    `  Real-time factor: ${(elapsed / (audioData.duration * 1000)).toFixed(2)}x`,
  );
}

function validateArgs(args: Args): void {
  if (!VALID_MODES.includes(args.mode)) {
    throw new Error(
      `Invalid mode: ${args.mode}. Valid modes: ${VALID_MODES.join(', ')}`,
    );
  }

  if (!fs.existsSync(args.audioFile)) {
    throw new Error(`Audio file not found: ${args.audioFile}`);
  }

  if (args.mode === Modes.LOCAL) {
    if (!args.sttModelPath) {
      throw new Error(
        `Local mode requires --sttModelPath or a discoverable default local STT model. Checked ${LOCAL_STT_MODEL_ENV_VAR} and bundled assets in ${LOCAL_MODELS_DIR}.`,
      );
    }
    if (!fs.existsSync(args.sttModelPath)) {
      throw new Error(`Local STT model not found: ${args.sttModelPath}`);
    }
    if (!fs.existsSync(args.vadModelPath)) {
      throw new Error(`Local VAD model not found: ${args.vadModelPath}`);
    }
    return;
  }

  if (args.providerConfig && args.providerConfig !== 'assemblyai') {
    throw new Error(
      "Invalid providerConfig. Currently only 'assemblyai' is supported.",
    );
  }
  if (!args.apiKey) {
    throw new Error('Cloud STT requires INWORLD_API_KEY environment variable.');
  }
}

function buildConfig(args: Args): StreamingSTTCreationConfig {
  return args.mode === Modes.LOCAL
    ? buildLocalConfig(args)
    : buildRemoteConfig(args);
}

function buildRemoteConfig(args: Args): RemoteStreamingSTTConfig {
  console.log('Using AssemblyAI provider configuration.');

  return {
    apiKey: args.apiKey,
    modelId: args.model,
    defaultTimeout: '30s',
    defaultConfig: {
      silenceThresholdMs: args.silenceThreshold,
      speechConfig: {
        activityDetectionConfig: ASSEMBLYAI_ACTIVITY_DETECTION,
      },
    },
  };
}

function buildLocalConfig(args: Args): LocalStreamingSTTConfig {
  console.log('Using local streaming STT configuration.');

  return {
    sttModelPath: args.sttModelPath,
    vadModelPath: args.vadModelPath,
    sttDevice: { type: DeviceType.CPU, index: 0 },
    vadDevice: { type: DeviceType.CPU, index: 0 },
    defaultConfig: {
      silenceThresholdMs: args.silenceThreshold,
    },
  };
}

/**
 * Loads and decodes a WAV audio file
 */
async function loadAudioFile(audioFile: string): Promise<{
  channelData: Float32Array[];
  sampleRate: number;
  duration: number;
}> {
  if (!fs.existsSync(audioFile)) {
    throw new Error(`Audio file not found: ${audioFile}`);
  }

  const buffer = fs.readFileSync(audioFile);
  const audioData = await WavDecoder.decode(buffer);

  if (!audioData.channelData || audioData.channelData.length === 0) {
    throw new Error('Invalid audio file: no channel data');
  }

  // Convert to proper Float32Array with ArrayBuffer
  const convertedChannels = audioData.channelData.map(
    (channel: Float32Array) => {
      const newArray = new Float32Array(new ArrayBuffer(channel.length * 4));
      newArray.set(channel);
      return newArray;
    },
  );

  return {
    channelData: convertedChannels,
    sampleRate: audioData.sampleRate,
    duration: audioData.channelData[0].length / audioData.sampleRate,
  };
}

async function* createRealtimeAudioStream(
  fullAudio: Float32Array,
  sampleRate: number,
  chunkSize: number,
  delayMs: number,
  silencePaddingMs: number = 0,
): AsyncIterable<any> {
  for (let i = 0; i < fullAudio.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, fullAudio.length);
    const length = end - i;

    const chunk = new Float32Array(new ArrayBuffer(length * 4));
    chunk.set(fullAudio.subarray(i, end));

    yield {
      data: float32ToBytes(chunk),
      sampleRate,
    };

    // Simulate real-time delay
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  if (silencePaddingMs > 0) {
    for await (const silenceChunk of generateSilenceChunks(
      sampleRate,
      chunkSize,
      silencePaddingMs,
      delayMs,
    )) {
      yield silenceChunk;
    }
  }
}

async function* generateSilenceChunks(
  sampleRate: number,
  chunkSize: number,
  totalSilenceMs: number,
  delayMs: number = 0,
): AsyncIterable<{
  data: Buffer;
  sampleRate: number;
}> {
  if (totalSilenceMs <= 0) {
    return;
  }

  const samplesPerMs = sampleRate / 1000;
  const totalSamples = Math.max(
    Math.ceil(samplesPerMs * totalSilenceMs),
    chunkSize,
  );

  let remainingSamples = totalSamples;
  while (remainingSamples > 0) {
    const currentLength = Math.min(chunkSize, remainingSamples);
    const chunk = new Float32Array(new ArrayBuffer(currentLength * 4));
    yield {
      data: float32ToBytes(chunk),
      sampleRate,
    };
    remainingSamples -= currentLength;

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function resolveSilencePaddingMs(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return SILENCE_THRESHOLD_MS;
  }
  return value;
}

function parseArgs(): Args {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['help'],
    string: [
      'mode',
      'providerConfig',
      'audioFile',
      'model',
      'sttModelPath',
      'vadModelPath',
    ],
    default: {
      mode: CLOUD_MODE,
      providerConfig: '',
      model: DEFAULT_STREAMING_STT_MODEL_ID,
      audioFile: path.join(
        __dirname,
        '..',
        'shared',
        'fixtures',
        'stt',
        'audio.wav',
      ),
      silenceThreshold: SILENCE_THRESHOLD_MS,
      sttModelPath: resolveDefaultLocalSttModelPath(),
      vadModelPath: DEFAULT_LOCAL_STREAMING_VAD_MODEL_PATH,
      help: false,
    },
  });

  const silenceThreshold = Number.parseFloat(String(argv.silenceThreshold));

  return {
    mode: argv.mode,
    model: argv.model,
    providerConfig: argv.providerConfig,
    audioFile: argv.audioFile,
    silenceThreshold: Number.isFinite(silenceThreshold)
      ? silenceThreshold
      : SILENCE_THRESHOLD_MS,
    sttModelPath: argv.sttModelPath,
    vadModelPath: argv.vadModelPath,
    apiKey: process.env.INWORLD_API_KEY || '',
    help: argv.help,
  };
}

function done() {
  console.log('\nReceived signal, stopping...');
  process.exit(0);
}

function resolveDefaultLocalSttModelPath(): string {
  const configuredPath = process.env[LOCAL_STT_MODEL_ENV_VAR];
  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  return discoverBundledLocalSttModelPath() || '';
}

function discoverBundledLocalSttModelPath(): string | undefined {
  if (!fs.existsSync(LOCAL_MODELS_DIR)) {
    return undefined;
  }

  const candidate = fs
    .readdirSync(LOCAL_MODELS_DIR, { withFileTypes: true })
    .find(
      (entry) =>
        !entry.name.startsWith('.') && !NON_STT_MODEL_ENTRIES.has(entry.name),
    );

  return candidate ? path.join(LOCAL_MODELS_DIR, candidate.name) : undefined;
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
    console.error(err.message);
  }
  process.exit(1);
});
