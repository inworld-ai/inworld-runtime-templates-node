/**
 * Basic AEC Filter Template
 *
 * This example demonstrates Acoustic Echo Cancellation (AEC) filtering using
 * the Inworld SDK. AEC removes speaker output (what the user is hearing) from
 * microphone input (what the user is saying) to prevent feedback loops in
 * full-duplex voice communication.
 *
 * AEC is essential for:
 * - Voice assistants with speakers and microphones
 * - Video conferencing systems
 * - Hands-free phone calls
 * - Any system where audio output can be picked up by the microphone
 *
 * Modes:
 * --mode=basic          : Basic echo cancellation with single audio pair
 * --mode=realtime       : Real-time continuous echo cancellation
 * --mode=streaming      : Process audio streams with echo detection
 * --mode=batch          : Batch process multiple audio pairs
 *
 * Usage:
 * npm run basic-aec-filter -- --mode=basic
 * npm run basic-aec-filter -- --mode=realtime --filterLength=200
 * npm run basic-aec-filter -- --mode=streaming
 * npm run basic-aec-filter -- --mode=batch
 */

import * as fs from 'fs';
import * as path from 'path';
const minimist = require('minimist');
const wavDecoder = require('wav-decoder');
import { bytesToFloat32 } from '@inworld/runtime/common';
import { InworldError } from '@inworld/runtime/common';
import { DeviceType } from '@inworld/runtime/core';
import { AECFilter } from '@inworld/runtime/primitives/speech';

const usage = `
Usage:
    npm run basic-aec-filter -- \n
    --mode=basic|realtime|streaming|batch[optional, default=basic] \n
    --audioFile=<path-to-audio-file>[optional, uses fixtures/stt/audio.wav] \n
    --filterLength=<filter-length-ms>[optional, default=200]
    
Note: AEC filter processes local audio to remove acoustic echo`;

interface Args {
  mode: 'basic' | 'realtime' | 'streaming' | 'batch';
  audioFile: string;
  filterLength: number;
  help?: boolean;
}

function parseArgs(): Args {
  const argv = minimist(process.argv.slice(2));

  if (argv.help || argv.h) {
    console.log(usage);
    process.exit(0);
  }

  const audioFile =
    argv.audioFile ||
    path.join(__dirname, '..', 'shared', 'fixtures', 'stt', 'audio.wav');

  return {
    mode: argv.mode || 'basic',
    audioFile,
    filterLength: argv.filterLength ? parseInt(argv.filterLength) : 200,
  };
}

/**
 * Load audio from WAV file
 */
async function loadAudioFile(
  filePath: string,
): Promise<{ data: Float32Array; sampleRate: number }> {
  const buffer = fs.readFileSync(filePath);
  const audioData = await wavDecoder.decode(buffer);

  // Convert to mono if stereo
  let audioSamples: Float32Array;
  if (audioData.channelData.length === 1) {
    audioSamples = audioData.channelData[0];
  } else {
    // Average stereo channels to mono
    const left = audioData.channelData[0];
    const right = audioData.channelData[1];
    audioSamples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      audioSamples[i] = (left[i] + right[i]) / 2;
    }
  }

  return {
    data: audioSamples,
    sampleRate: audioData.sampleRate,
  };
}

/**
 * Simulate speaker audio by adding delay and attenuation
 */
function simulateSpeakerAudio(
  originalAudio: Float32Array,
  delaySamples: number,
  attenuation: number,
): Float32Array {
  const speakerAudio = new Float32Array(originalAudio.length);

  // Add delayed and attenuated version (simulating echo)
  for (let i = delaySamples; i < originalAudio.length; i++) {
    speakerAudio[i] = originalAudio[i - delaySamples] * attenuation;
  }

  return speakerAudio;
}

/**
 * Simulate microphone audio with echo
 */
function simulateMicrophoneWithEcho(
  originalAudio: Float32Array,
  speakerAudio: Float32Array,
  echoLevel: number,
): Float32Array {
  const micAudio = new Float32Array(originalAudio.length);

  // Mix original with speaker audio (echo)
  for (let i = 0; i < originalAudio.length; i++) {
    micAudio[i] = originalAudio[i] + speakerAudio[i] * echoLevel;
  }

  return micAudio;
}

/**
 * Calculate signal-to-noise ratio (SNR)
 */
function calculateSNR(signal: Float32Array, noise: Float32Array): number {
  let signalPower = 0;
  let noisePower = 0;

  for (let i = 0; i < Math.min(signal.length, noise.length); i++) {
    signalPower += signal[i] * signal[i];
    noisePower += noise[i] * noise[i];
  }

  signalPower /= signal.length;
  noisePower /= noise.length;

  if (noisePower === 0) return Infinity;
  return 10 * Math.log10(signalPower / noisePower);
}

/**
 * Basic AEC Example
 * Demonstrates simple echo cancellation with a single audio pair
 */
async function runBasicExample(audioFile: string) {
  console.log('\n=== Basic AEC Example ===\n');

  try {
    // Load audio file
    console.log(`Loading audio: ${path.basename(audioFile)}`);
    const audio = await loadAudioFile(audioFile);
    console.log(
      `Loaded ${audio.data.length} samples at ${audio.sampleRate} Hz\n`,
    );

    // Simulate speaker output (delayed and attenuated original)
    console.log('Simulating speaker output...');
    const speakerAudio = simulateSpeakerAudio(
      audio.data,
      Math.floor(audio.sampleRate * 0.05), // 50ms delay
      0.3, // 30% volume
    );

    // Simulate microphone input with echo
    console.log('Simulating microphone input with echo...');
    const micAudio = simulateMicrophoneWithEcho(
      audio.data,
      speakerAudio,
      0.4, // 40% echo level
    );

    // Create AEC filter
    console.log(`\nCreating AEC filter...`);
    const aecFilter = await AECFilter.create({
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: {},
    });
    console.log('AEC filter created!\n');

    // Detect echo before filtering
    const hasEcho = await aecFilter.detectEcho(
      { data: Buffer.from(micAudio), sampleRate: audio.sampleRate },
      { data: Buffer.from(speakerAudio), sampleRate: audio.sampleRate },
    );
    console.log(`Echo detection: ${hasEcho ? '✓ Echo detected' : '✗ No echo'}`);

    // Filter audio
    console.log('\nFiltering audio to remove echo...');
    const filtered = await aecFilter.filterAudio(
      { data: Buffer.from(micAudio), sampleRate: audio.sampleRate },
      { data: Buffer.from(speakerAudio), sampleRate: audio.sampleRate },
    );

    // Calculate improvement
    const originalSNR = calculateSNR(audio.data, micAudio);
    const filteredData = filtered.data
      ? bytesToFloat32(new Uint8Array(filtered.data))
      : new Float32Array(0);
    const filteredSNR = calculateSNR(audio.data, filteredData);

    console.log('\n📊 Results:');
    console.log('────────────────────────────────────────────────────────────');
    console.log(`Original audio:  ${audio.data.length} samples`);
    console.log(`Microphone:      ${micAudio.length} samples (with echo)`);
    console.log(`Filtered audio:  ${filtered.data?.length || 0} samples`);
    console.log(
      `\nSNR improvement: ${(filteredSNR - originalSNR).toFixed(2)} dB`,
    );
    console.log(`Echo reduction:  ${hasEcho ? 'Successful ✓' : 'Not needed'}`);
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Real-time AEC Example
 * Demonstrates continuous echo cancellation on streaming audio
 */
async function runRealtimeExample(audioFile: string) {
  console.log('\n=== Real-time AEC Example ===\n');

  try {
    // Load audio
    const audio = await loadAudioFile(audioFile);
    console.log(
      `Loaded audio: ${audio.data.length} samples at ${audio.sampleRate} Hz`,
    );

    // Create AEC filter
    console.log('Creating AEC filter...\n');
    const aecFilter = await AECFilter.create({
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: {},
    });

    // Simulate real-time processing with chunks
    const chunkSizeMs = 100; // 100ms chunks
    const chunkSize = Math.floor((audio.sampleRate * chunkSizeMs) / 1000);

    console.log(
      '🎤 Simulating real-time echo cancellation (100ms chunks)...\n',
    );

    let totalProcessed = 0;
    let totalFiltered = 0;

    for (let i = 0; i < audio.data.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, audio.data.length);
      const chunk = new Float32Array(audio.data.slice(i, end));

      // Simulate speaker output
      const speakerChunk = simulateSpeakerAudio(
        chunk,
        Math.floor(audio.sampleRate * 0.05),
        0.3,
      );

      // Simulate microphone with echo
      const micChunk = simulateMicrophoneWithEcho(chunk, speakerChunk, 0.4);

      // Filter the chunk
      const filtered = await aecFilter.filterAudio(
        { data: Buffer.from(micChunk), sampleRate: audio.sampleRate },
        { data: Buffer.from(speakerChunk), sampleRate: audio.sampleRate },
      );

      totalProcessed += chunk.length;
      totalFiltered += filtered.data
        ? bytesToFloat32(new Uint8Array(filtered.data)).length
        : 0;

      // Show progress every 500ms
      if (i % (chunkSize * 5) === 0) {
        const timeMs = (totalProcessed / audio.sampleRate) * 1000;
        const hasEcho = await aecFilter.detectEcho(
          { data: Buffer.from(micChunk), sampleRate: audio.sampleRate },
          {
            data: Buffer.from(speakerChunk),
            sampleRate: audio.sampleRate,
          },
        );
        console.log(
          `[${timeMs.toFixed(0)}ms] Processed ${totalProcessed} samples | Echo: ${hasEcho ? '✓' : '✗'}`,
        );
      }
    }

    console.log('\n✅ Real-time processing complete!');
    console.log(`Total samples processed: ${totalProcessed}`);
    console.log(`Total samples filtered:  ${totalFiltered}`);
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Streaming AEC Example
 * Demonstrates async streaming with echo detection
 */
async function runStreamingExample(audioFile: string) {
  console.log('\n=== Streaming AEC Example ===\n');

  try {
    // Load audio
    const audio = await loadAudioFile(audioFile);
    console.log(`Loaded audio: ${audio.data.length} samples\n`);

    // Create AEC filter
    console.log('Creating AEC filter...');
    const aecFilter = await AECFilter.create({
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: {},
    });
    console.log('AEC filter created!\n');

    // Simulate continuous streams
    const chunkSize = Math.floor(audio.sampleRate * 0.1); // 100ms chunks

    // Create async generators for mic and speaker streams
    async function* createMicStream(): AsyncGenerator<{
      data?: Buffer;
      sampleRate: number;
    }> {
      for (let i = 0; i < audio.data.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, audio.data.length);
        const chunk = new Float32Array(audio.data.slice(i, end));
        const speakerChunk = simulateSpeakerAudio(
          chunk,
          Math.floor(audio.sampleRate * 0.05),
          0.3,
        );
        const micChunk = simulateMicrophoneWithEcho(chunk, speakerChunk, 0.4);

        yield {
          data: Buffer.from(micChunk),
          sampleRate: audio.sampleRate,
        };

        // Simulate real-time delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    async function* createSpeakerStream(): AsyncGenerator<{
      data?: Buffer;
      sampleRate: number;
    }> {
      for (let i = 0; i < audio.data.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, audio.data.length);
        const chunk = new Float32Array(audio.data.slice(i, end));
        const speakerChunk = simulateSpeakerAudio(
          chunk,
          Math.floor(audio.sampleRate * 0.05),
          0.3,
        );

        yield {
          data: Buffer.from(speakerChunk),
          sampleRate: audio.sampleRate,
        };

        // Simulate real-time delay
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    console.log('🌊 Processing audio streams with echo cancellation...\n');

    let frameCount = 0;
    let _echoDetectedCount = 0;

    // Process streams
    const micStream = createMicStream();
    const speakerStream = createSpeakerStream();

    for await (const filtered of aecFilter.filterStreams(
      micStream as any,
      speakerStream as any,
    )) {
      frameCount++;

      if (frameCount % 5 === 0) {
        console.log(
          `Frame ${frameCount}: ${filtered.data?.length || 0} samples filtered`,
        );
      }
    }

    console.log(`\n✅ Streaming complete!`);
    console.log(`Total frames processed: ${frameCount}`);
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Batch AEC Example
 * Demonstrates batch processing of multiple audio pairs
 */
async function runBatchExample(audioFile: string) {
  console.log('\n=== Batch AEC Example ===\n');

  try {
    // Load audio
    const audio = await loadAudioFile(audioFile);
    console.log(`Loaded audio: ${audio.data.length} samples\n`);

    // Create AEC filter
    console.log('Creating AEC filter...');
    const aecFilter = await AECFilter.create({
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: {},
    });
    console.log('AEC filter created!\n');

    // Create multiple audio pairs with varying echo levels
    const chunkSize = Math.floor(audio.data.length / 5);
    const pairs: Array<{
      mic: { data: Buffer; sampleRate: number };
      speakers: { data: Buffer; sampleRate: number };
      echoLevel: number;
    }> = [];

    console.log('Preparing 5 audio pairs with different echo levels...\n');

    for (let i = 0; i < 5; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, audio.data.length);
      const chunk = new Float32Array(audio.data.slice(start, end));

      const echoLevel = 0.2 + i * 0.15; // Increasing echo levels
      const speakerChunk = simulateSpeakerAudio(
        chunk,
        Math.floor(audio.sampleRate * 0.05),
        0.3,
      );
      const micChunk = simulateMicrophoneWithEcho(
        chunk,
        speakerChunk,
        echoLevel,
      );

      pairs.push({
        mic: { data: Buffer.from(micChunk), sampleRate: audio.sampleRate },
        speakers: {
          data: Buffer.from(speakerChunk),
          sampleRate: audio.sampleRate,
        },
        echoLevel,
      });

      console.log(
        `Pair ${i + 1}: ${chunk.length} samples, echo level: ${(echoLevel * 100).toFixed(0)}%`,
      );
    }

    // Process batch
    console.log('\n🔄 Processing batch...');
    const startTime = Date.now();

    const filtered = await aecFilter.filterBatch(pairs as any);

    const processingTime = Date.now() - startTime;

    console.log('\n✅ Batch processing complete!\n');
    console.log('📊 Results:');
    console.log('────────────────────────────────────────────────────────────');

    for (let i = 0; i < filtered.length; i++) {
      const originalSamples = bytesToFloat32(pairs[i].mic.data).length;
      const filteredSamples = filtered[i].data
        ? bytesToFloat32(filtered[i].data).length
        : 0;
      const _reduction =
        ((originalSamples - filteredSamples) / originalSamples) * 100;

      console.log(`\nPair ${i + 1}:`);
      console.log(
        `  Echo level:       ${(pairs[i].echoLevel * 100).toFixed(0)}%`,
      );
      console.log(`  Original samples: ${originalSamples}`);
      console.log(`  Filtered samples: ${filteredSamples}`);
    }

    console.log(`\n⏱️  Processing time: ${processingTime}ms`);
    console.log(
      `📈 Throughput: ${((pairs.length / processingTime) * 1000).toFixed(1)} pairs/sec`,
    );
  } catch (error) {
    if (error instanceof InworldError) {
      console.error('Inworld Error:', {
        message: error.message,
        context: error.context,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const args = parseArgs();

  console.log('🎧 Inworld AEC Filter Template');
  console.log('═══════════════════════════════════════════════════════════');

  // Check if audio file exists
  if (!fs.existsSync(args.audioFile)) {
    console.error(`\n❌ Audio file not found: ${args.audioFile}`);
    console.error('\nPlease provide a valid audio file path.\n');
    process.exit(1);
  }

  switch (args.mode) {
    case 'basic':
      await runBasicExample(args.audioFile);
      break;

    case 'realtime':
      await runRealtimeExample(args.audioFile);
      break;

    case 'streaming':
      await runStreamingExample(args.audioFile);
      break;

    case 'batch':
      await runBatchExample(args.audioFile);
      break;

    default:
      console.error(`\n❌ Unknown mode: ${args.mode}`);
      console.log(usage);
      process.exit(1);
  }
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
