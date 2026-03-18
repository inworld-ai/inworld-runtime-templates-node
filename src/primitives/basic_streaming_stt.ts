/**
 * Streaming STT Example - Cloud Version
 *
 * This example demonstrates real-time speech-to-text transcription using
 * the StreamingSTT primitive with cloud providers (AssemblyAI).
 *
 * Usage:
 *   npm run basic-streaming-stt -- --useCloud
 *
 * Configuration values:
 * - Sample rate: 16000 Hz
 * - Frame size: 2048 samples (128ms chunks)
 * - Default silence threshold: 3000ms
 * - Activity detection: endOfTurnConfidenceThreshold=0.5,
 *   minEndOfTurnSilenceWhenConfident=500ms, maxTurnSilence=2000ms
 */

import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { float32ToBytes, InworldError } from '@inworld/runtime/common';
import type { RemoteStreamingSTTConfig } from '@inworld/runtime/primitives/speech';
import { StreamingSTT } from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const usage = `
Streaming STT Example - Cloud Version

Usage:
  npm run basic-streaming-stt -- --useCloud

Options:
  --useCloud              Use cloud streaming STT (requires INWORLD_API_KEY)
  --model                 STT model ID (default: assemblyai/universal-streaming-multilingual)
  --providerConfig        Provider config type: 'assemblyai' (default)
  --audioFile             Path to audio file (default: fixtures/stt/audio.wav)
  --silenceThreshold      Silence threshold in ms (default: 3000)
  --help                  Show this help message

Available STT models:
  assemblyai/universal-streaming-multilingual  (default)
  assemblyai/u3-rt-pro
  inworld/inworld-stt-1

Environment:
  INWORLD_API_KEY         Required for cloud STT
`;

const SILENCE_THRESHOLD_MS = 3000;
const ASSEMBLYAI_MODEL_ID = 'assemblyai/universal-streaming-multilingual';
const ASSEMBLYAI_ACTIVITY_DETECTION = {
  endOfTurnConfidenceThreshold: 0.5,
  minEndOfTurnSilenceWhenConfidentMs: 500,
  maxTurnSilenceMs: 2000,
};

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
  useCloud: boolean;
  model: string;
  providerConfig: string;
  audioFile: string;
  silenceThreshold: number;
  apiKey: string;
  help: boolean;
}

/**
 * Main streaming STT function
 */
async function runStreamingSTT(args: Args): Promise<void> {
  validateArgs(args);
  const config = buildRemoteConfig(args);

  console.log('\n=== Streaming STT Example ===\n');
  console.log('Mode: Cloud (Remote)');
  console.log(`Provider: ${args.providerConfig || 'assemblyai'}`);
  console.log(`Model: ${args.model}`);
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
  if (!args.useCloud) {
    throw new Error('This example requires --useCloud flag for cloud STT.');
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
    boolean: ['useCloud', 'help'],
    string: ['providerConfig', 'audioFile', 'model'],
    default: {
      useCloud: false,
      providerConfig: '',
      model: ASSEMBLYAI_MODEL_ID,
      audioFile: path.join(
        __dirname,
        '..',
        'shared',
        'fixtures',
        'stt',
        'audio.wav',
      ),
      silenceThreshold: SILENCE_THRESHOLD_MS,
      help: false,
    },
  });

  return {
    useCloud: argv.useCloud,
    model: argv.model,
    providerConfig: argv.providerConfig,
    audioFile: argv.audioFile,
    silenceThreshold: argv.silenceThreshold,
    apiKey: process.env.INWORLD_API_KEY!,
    help: argv.help,
  };
}

function done() {
  console.log('\nReceived signal, stopping...');
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
    console.error(err.message);
  }
  process.exit(1);
});
