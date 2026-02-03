import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { float32ToBytes, InworldError } from '@inworld/runtime/common';
import { StreamingSTT } from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-streaming-stt -- \n
    --mode=basic|realtime|chunking|continuous[optional, default=basic] \n
    --audioFile=<path-to-audio-file>[optional, uses fixtures/stt/audio.wav] \n
    --languageCode=<language-code>[optional, default=en-US] \n
    --silenceThreshold=<milliseconds>[optional, default=1500]
    
Note: INWORLD_API_KEY environment variable must be set`;

run();

async function run() {
  const { mode, audioFile, languageCode, silenceThreshold, apiKey } =
    parseArgs();

  try {
    switch (mode) {
      case 'basic':
        await runBasicExample(
          audioFile,
          languageCode,
          silenceThreshold,
          apiKey,
        );
        break;
      case 'realtime':
        await runRealtimeExample(
          audioFile,
          languageCode,
          silenceThreshold,
          apiKey,
        );
        break;
      case 'chunking':
        await runChunkingExample(audioFile, languageCode, apiKey);
        break;
      case 'continuous':
        await runContinuousExample(
          audioFile,
          languageCode,
          silenceThreshold,
          apiKey,
        );
        break;
      default:
        console.error('Unknown mode:', mode);
        process.exit(1);
    }
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

/**
 * Basic streaming example - Stream audio chunks and get transcriptions
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {number} silenceThreshold - Silence threshold in ms
 * @param {string} apiKey - API key
 */
async function runBasicExample(
  audioFile: string,
  languageCode: string,
  silenceThreshold: number,
  apiKey: string,
) {
  console.log('\n=== Basic Streaming STT Example ===\n');

  console.log(`Audio file: ${audioFile}`);
  console.log(`Language: ${languageCode}`);
  console.log(`Silence threshold: ${silenceThreshold}ms\n`);

  // Create StreamingSTT instance
  console.log('Creating StreamingSTT instance...');
  const streamingSTT = await StreamingSTT.create({
    apiKey,
    defaultTimeout: '3000s',
    defaultConfig: {
      silenceThresholdMs: silenceThreshold,
      speechConfig: { language: languageCode },
    },
  });
  console.log('StreamingSTT instance created!\n');

  // Load audio file
  const audioData = await loadAudioFile(audioFile);
  console.log(`Loaded audio: ${audioData.duration.toFixed(2)}s\n`);

  // Create audio stream from chunks
  const chunkSize = Math.floor(audioData.sampleRate * 0.5); // 500ms chunks
  const trailingSilenceMs = resolveSilencePaddingMs(silenceThreshold);
  const audioStream = createAudioStream(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
    trailingSilenceMs,
  );

  console.log('Streaming audio and transcribing...');
  console.log('─'.repeat(60));

  const startTime = Date.now();
  const session = await streamingSTT.startRecognizeSpeechSession(audioStream);

  let transcriptionCount = 0;
  const transcriptions: string[] = [];

  for await (const result of session) {
    transcriptionCount++;
    transcriptions.push(result.text);
    console.log(`[${transcriptionCount}] ${result.text}`);
  }

  const duration = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('\nStreaming Statistics:');
  console.log(`  • Total transcriptions: ${transcriptionCount}`);
  console.log(`  • Processing time: ${duration}ms`);
  console.log(`  • Audio duration: ${audioData.duration.toFixed(2)}s`);
  console.log(
    `  • Real-time factor: ${(duration / (audioData.duration * 1000)).toFixed(2)}x`,
  );

  if (transcriptions.length > 0) {
    console.log('\nFinal transcription:');
    console.log(`  ${transcriptions.join(' ')}`);
  }
}

/**
 * Realtime simulation example - Simulate real-time audio streaming with delays
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {number} silenceThreshold - Silence threshold in ms
 * @param {string} apiKey - API key
 */
async function runRealtimeExample(
  audioFile: string,
  languageCode: string,
  silenceThreshold: number,
  apiKey: string,
) {
  console.log('\n=== Realtime Streaming Example ===\n');

  console.log('Simulating real-time audio streaming...\n');

  const streamingSTT = await StreamingSTT.create({
    apiKey,
    defaultTimeout: '30s',
    defaultConfig: {
      silenceThresholdMs: silenceThreshold,
      speechConfig: { language: languageCode },
    },
  });

  const audioData = await loadAudioFile(audioFile);
  console.log(`Audio duration: ${audioData.duration.toFixed(2)}s\n`);

  // Simulate real-time with 100ms chunks and delays
  const chunkSize = Math.floor(audioData.sampleRate * 0.1); // 100ms chunks
  const trailingSilenceMs = resolveSilencePaddingMs(silenceThreshold);
  const audioStream = createRealtimeAudioStream(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
    100, // 100ms delay between chunks
    trailingSilenceMs,
  );

  console.log('Streaming audio in real-time...');
  console.log('─'.repeat(60));

  const session = await streamingSTT.startRecognizeSpeechSession(audioStream);

  const startTime = Date.now();
  let partialCount = 0;

  for await (const result of session) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    partialCount++;
    console.log(`[${elapsed}s] Partial ${partialCount}: "${result.text}"`);
  }

  console.log('─'.repeat(60));
  console.log('\n✓ Real-time streaming complete!');
}

/**
 * Chunking strategies example - Test different silence thresholds
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {string} apiKey - API key
 */
async function runChunkingExample(
  audioFile: string,
  languageCode: string,
  apiKey: string,
) {
  console.log('\n=== Chunking Strategies Example ===\n');

  console.log('Testing different silence thresholds...\n');

  const audioData = await loadAudioFile(audioFile);

  const thresholds = [
    { ms: 500, description: 'Aggressive (500ms) - More chunks' },
    { ms: 1000, description: 'Moderate (1000ms) - Balanced' },
    { ms: 1500, description: 'Default (1500ms) - Standard' },
    { ms: 2000, description: 'Conservative (2000ms) - Fewer chunks' },
  ];

  for (const threshold of thresholds) {
    console.log(`Testing: ${threshold.description}`);
    console.log('─'.repeat(60));

    const streamingSTT = await StreamingSTT.create({
      apiKey,
      defaultTimeout: '30s',
      defaultConfig: {
        silenceThresholdMs: threshold.ms,
        speechConfig: { language: languageCode },
      },
    });

    const chunkSize = Math.floor(audioData.sampleRate * 0.5);
    const audioStream = createAudioStream(
      audioData.channelData[0],
      audioData.sampleRate,
      chunkSize,
      resolveSilencePaddingMs(threshold.ms),
    );

    try {
      const session =
        await streamingSTT.startRecognizeSpeechSession(audioStream);
      const startTime = Date.now();

      const transcriptions: string[] = [];
      for await (const result of session) {
        transcriptions.push(result.text);
      }

      const duration = Date.now() - startTime;

      console.log(`  ✓ Chunks received: ${transcriptions.length}`);
      console.log(`  • Processing time: ${duration}ms`);
      console.log(`  • Transcription: "${transcriptions.join(' ')}"`);
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
  }

  console.log('─'.repeat(60));
  console.log('\nObservation: Lower thresholds produce more frequent updates,');
  console.log(
    '            higher thresholds wait longer for complete phrases.',
  );
}

/**
 * Continuous streaming example - Long-running session with multiple audio sources
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {number} silenceThreshold - Silence threshold in ms
 * @param {string} apiKey - API key
 */
async function runContinuousExample(
  audioFile: string,
  languageCode: string,
  silenceThreshold: number,
  apiKey: string,
) {
  console.log('\n=== Continuous Streaming Example ===\n');

  console.log('Simulating continuous streaming session...\n');

  const streamingSTT = await StreamingSTT.create({
    apiKey,
    defaultTimeout: '30s',
    defaultConfig: {
      silenceThresholdMs: silenceThreshold,
      speechConfig: { language: languageCode },
    },
  });

  const audioData = await loadAudioFile(audioFile);

  // Split audio into 3 segments to simulate continuous streaming
  const fullAudio = audioData.channelData[0];
  const segmentLength = Math.floor(fullAudio.length / 3);

  console.log('Streaming audio in 3 continuous segments...');
  console.log(`Total duration: ${audioData.duration.toFixed(2)}s\n`);

  const audioStream = createContinuousAudioStream(
    fullAudio,
    audioData.sampleRate,
    segmentLength,
    resolveSilencePaddingMs(silenceThreshold),
  );

  console.log('─'.repeat(60));

  const session = await streamingSTT.startRecognizeSpeechSession(audioStream);

  let segmentNum = 0;
  let transcriptionCount = 0;
  const allTranscriptions: string[] = [];

  for await (const result of session) {
    transcriptionCount++;
    allTranscriptions.push(result.text);

    // Estimate which segment this belongs to
    const currentSegment = Math.floor((transcriptionCount - 1) / 2) + 1;
    if (currentSegment !== segmentNum) {
      segmentNum = currentSegment;
      console.log(`\nSegment ${segmentNum}:`);
    }

    console.log(`  [${transcriptionCount}] ${result.text}`);
  }

  console.log('─'.repeat(60));
  console.log('\nContinuous Streaming Summary:');
  console.log(`  • Total transcriptions: ${transcriptionCount}`);
  console.log(`  • Segments processed: 3`);
  console.log('\nComplete transcription:');
  console.log(`  ${allTranscriptions.join(' ')}`);
}

/**
 * Load audio file and decode to Float32Array
 *
 * @param {string} audioFile - Path to audio file
 * @returns {Promise<any>} Decoded audio data
 */
async function loadAudioFile(audioFile: string): Promise<any> {
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

  audioData.duration = audioData.channelData[0].length / audioData.sampleRate;
  audioData.channelData = convertedChannels;

  return audioData;
}

/**
 * Create audio stream generator from audio data
 *
 * @param {Float32Array} fullAudio - Complete audio data
 * @param {number} sampleRate - Sample rate
 * @param {number} chunkSize - Size of each chunk in samples
 * @param silencePaddingMs
 * @returns {AsyncIterable<any>} Audio stream
 */
async function* createAudioStream(
  fullAudio: Float32Array,
  sampleRate: number,
  chunkSize: number,
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
  }

  if (silencePaddingMs > 0) {
    for await (const silenceChunk of generateSilenceChunks(
      sampleRate,
      chunkSize,
      silencePaddingMs,
    )) {
      yield silenceChunk;
    }
  }
}

/**
 * Create realtime audio stream with delays
 *
 * @param {Float32Array} fullAudio - Complete audio data
 * @param {number} sampleRate - Sample rate
 * @param {number} chunkSize - Size of each chunk in samples
 * @param {number} delayMs - Delay between chunks in milliseconds
 * @param silencePaddingMs
 * @returns {AsyncIterable<any>} Audio stream
 */
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

/**
 * Create continuous audio stream from segments
 *
 * @param {Float32Array} fullAudio - Complete audio data
 * @param {number} sampleRate - Sample rate
 * @param {number} segmentLength - Length of each segment in samples
 * @param silencePaddingMs
 * @returns {AsyncIterable<any>} Audio stream
 */
async function* createContinuousAudioStream(
  fullAudio: Float32Array,
  sampleRate: number,
  segmentLength: number,
  silencePaddingMs: number = 0,
): AsyncIterable<any> {
  const chunkSize = Math.floor(sampleRate * 0.5); // 500ms chunks

  for (let i = 0; i < fullAudio.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, fullAudio.length);
    const length = end - i;

    const chunk = new Float32Array(new ArrayBuffer(length * 4));
    chunk.set(fullAudio.subarray(i, end));

    yield {
      data: float32ToBytes(chunk),
      sampleRate,
    };

    // Add a small pause between segments
    if ((i + chunkSize) % segmentLength < chunkSize) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  if (silencePaddingMs > 0) {
    for await (const silenceChunk of generateSilenceChunks(
      sampleRate,
      chunkSize,
      silencePaddingMs,
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
  const DEFAULT_PADDING_MS = 1500;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_PADDING_MS;
  }
  return value;
}

function parseArgs(): {
  mode: string;
  audioFile: string;
  languageCode: string;
  silenceThreshold: number;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'basic';
  const audioFile =
    argv.audioFile ||
    path.join(__dirname, '..', 'shared', 'fixtures', 'stt', 'audio.wav');
  const languageCode = argv.languageCode || 'en-US';
  const silenceThreshold = argv.silenceThreshold || 1500;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { mode, audioFile, languageCode, silenceThreshold, apiKey };
}

function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: err.context,
    });
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
