import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { STT } from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const usage = `
Usage:
    yarn basic-stt \n
    --mode=basic|streaming|language|batch[optional, default=basic] \n
    --audioFile=<path-to-audio-file>[optional, uses default fixture] \n
    --languageCode=<language-code>[optional, default=en-US]
    
Note: INWORLD_API_KEY environment variable must be set`;

run();

async function run() {
  const { mode, audioFile, languageCode, apiKey } = parseArgs();

  try {
    switch (mode) {
      case 'basic':
        await runBasicExample(audioFile, languageCode, apiKey);
        break;
      case 'streaming':
        await runStreamingExample(audioFile, languageCode, apiKey);
        break;
      case 'language':
        await runLanguageExample(audioFile, apiKey);
        break;
      case 'batch':
        await runBatchExample(languageCode, apiKey);
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
 * Basic STT example - Simple audio transcription
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {string} apiKey - API key
 */
async function runBasicExample(
  audioFile: string,
  languageCode: string,
  apiKey: string,
) {
  console.log('\n=== Basic STT Example ===\n');

  // Load audio file
  console.log(`Loading audio file: ${audioFile}`);
  const audioData = await loadAudioFile(audioFile);
  console.log(
    `Audio loaded: ${audioData.duration.toFixed(2)}s, ${audioData.sampleRate}Hz\n`,
  );

  // Create STT instance
  console.log('Creating STT instance...');
  const stt = await STT.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      defaultConfig: {
        languageCode,
      },
    },
  });
  console.log('STT instance created!\n');

  // Transcribe audio
  console.log('Transcribing audio...');
  const transcription = await stt.recognizeSpeechComplete(
    {
      data: audioData.channelData[0],
      sampleRate: audioData.sampleRate,
    },
    {
      languageCode,
    },
  );

  console.log('─'.repeat(60));
  console.log('Transcription:');
  console.log(transcription);
  console.log('─'.repeat(60));
}

/**
 * Streaming example - Show transcription chunks as they arrive
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} languageCode - Language code
 * @param {string} apiKey - API key
 */
async function runStreamingExample(
  audioFile: string,
  languageCode: string,
  apiKey: string,
) {
  console.log('\n=== Streaming STT Example ===\n');

  const audioData = await loadAudioFile(audioFile);
  console.log(
    `Audio loaded: ${audioData.duration.toFixed(2)}s, ${audioData.sampleRate}Hz\n`,
  );

  const stt = await STT.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
    },
  });

  console.log('Transcribing audio (streaming)...');
  console.log('─'.repeat(60));

  const stream = await stt.recognizeSpeech(
    {
      data: audioData.channelData[0],
      sampleRate: audioData.sampleRate,
    },
    {
      languageCode,
    },
  );

  let fullTranscription = '';
  let chunkCount = 0;
  const startTime = Date.now();

  for await (const textChunk of stream) {
    chunkCount++;
    fullTranscription += textChunk;
    console.log(`Chunk ${chunkCount}: "${textChunk}"`);
  }

  const duration = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('\nStreaming Statistics:');
  console.log(`  • Chunks received: ${chunkCount}`);
  console.log(`  • Duration: ${duration}ms`);
  console.log(`  • Characters: ${fullTranscription.length}`);
  console.log('\nFull transcription:');
  console.log(fullTranscription);
}

/**
 * Language example - Transcribe with different language codes
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} apiKey - API key
 */
async function runLanguageExample(audioFile: string, apiKey: string) {
  console.log('\n=== Language Detection Example ===\n');

  const audioData = await loadAudioFile(audioFile);

  const stt = await STT.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
    },
  });

  // Try different language codes
  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
  ];

  console.log('Transcribing audio with different language settings:\n');

  for (const lang of languages) {
    console.log(`Language: ${lang.name} (${lang.code})`);
    console.log('─'.repeat(60));

    try {
      const transcription = await stt.recognizeSpeechComplete(
        {
          data: audioData.channelData[0],
          sampleRate: audioData.sampleRate,
        },
        {
          languageCode: lang.code,
        },
      );

      console.log(transcription || '(no transcription)');
    } catch (error) {
      console.log(`Error: ${error.message}`);
    }

    console.log();
  }
}

/**
 * Batch example - Transcribe multiple audio segments
 *
 * @param {string} languageCode - Language code
 * @param {string} apiKey - API key
 */
async function runBatchExample(languageCode: string, apiKey: string) {
  console.log('\n=== Batch Transcription Example ===\n');

  // Get default audio file
  const defaultAudioPath = path.join(
    __dirname,
    '..',
    'shared',
    'fixtures',
    'stt',
    'audio.wav',
  );

  const audioData = await loadAudioFile(defaultAudioPath);

  const stt = await STT.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      defaultConfig: {
        languageCode,
      },
    },
  });

  // Split audio into segments (simulate multiple audio clips)
  const segmentDuration = 2.0; // seconds
  const segmentSamples = Math.floor(segmentDuration * audioData.sampleRate);
  const fullAudio = audioData.channelData[0];
  const segments: Array<Float32Array<ArrayBuffer>> = [];

  for (let i = 0; i < fullAudio.length; i += segmentSamples) {
    const end = Math.min(i + segmentSamples, fullAudio.length);
    // Create a new Float32Array with explicit ArrayBuffer
    const length = end - i;
    const segment = new Float32Array(new ArrayBuffer(length * 4));
    segment.set(fullAudio.subarray(i, end));
    segments.push(segment);
  }

  console.log(`Processing ${segments.length} audio segments...\n`);

  const results: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    console.log(`Segment ${i + 1}/${segments.length}:`);

    try {
      const transcription = await stt.recognizeSpeechComplete(
        {
          data: segments[i] as Float32Array<ArrayBuffer>,
          sampleRate: audioData.sampleRate,
        },
        {
          languageCode,
        },
      );

      results.push(transcription);
      console.log(`  "${transcription}"`);
    } catch (error) {
      console.log(`  Error: ${error.message}`);
      results.push('');
    }
  }

  console.log('\n─'.repeat(60));
  console.log('Combined transcription:');
  console.log(results.join(' '));
  console.log('─'.repeat(60));
}

/**
 * Load and decode WAV audio file
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

  // Ensure we have audio data
  if (!audioData.channelData || audioData.channelData.length === 0) {
    throw new Error('Invalid audio file: no channel data');
  }

  // Convert channelData to proper Float32Array with ArrayBuffer
  // This fixes TypeScript type issues with ArrayBufferLike vs ArrayBuffer
  const convertedChannels = audioData.channelData.map(
    (channel: Float32Array) => {
      const newArray = new Float32Array(new ArrayBuffer(channel.length * 4));
      newArray.set(channel);
      return newArray;
    },
  );

  // Calculate duration
  audioData.duration = audioData.channelData[0].length / audioData.sampleRate;
  audioData.channelData = convertedChannels;

  return audioData;
}

function parseArgs(): {
  mode: string;
  audioFile: string;
  languageCode: string;
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
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { mode, audioFile, languageCode, apiKey };
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
