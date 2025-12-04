import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { InworldError } from '@inworld/runtime/common';
import { TTS } from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const wavEncoder = require('wav-encoder');
const minimist = require('minimist');

const usage = `
Usage:
    yarn basic-tts \n
    --mode=basic|streaming|voices|batch[optional, default=basic] \n
    --text=<text-to-synthesize>[optional, uses default text] \n
    --voice=<voice-id>[optional, default=Ashley] \n
    --outputDir=<output-directory>[optional, default=data-output/tts]
    
Available voices: Ashley, Dennis, Alex, Craig, Deborah, Edward, Elizabeth, 
                  Hades, Julia, Mark, Olivia, Pixie, Priya, Ronald, Sarah, 
                  Shaun, Theodore, Timothy, Wendy, Dominus
                  
Note: INWORLD_API_KEY environment variable must be set`;

run();

async function run() {
  const { mode, text, voice, outputDir, apiKey } = parseArgs();

  try {
    switch (mode) {
      case 'basic':
        await runBasicExample(text, voice, outputDir, apiKey);
        break;
      case 'streaming':
        await runStreamingExample(text, voice, outputDir, apiKey);
        break;
      case 'voices':
        await runVoicesExample(text, outputDir, apiKey);
        break;
      case 'batch':
        await runBatchExample(voice, outputDir, apiKey);
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
 * Basic TTS example - Simple text-to-speech synthesis
 *
 * @param {string} text - Text to synthesize
 * @param {string} voice - Voice ID
 * @param {string} outputDir - Output directory
 * @param {string} apiKey - API key
 */
async function runBasicExample(
  text: string,
  voice: string,
  outputDir: string,
  apiKey: string,
) {
  console.log('\n=== Basic TTS Example ===\n');

  console.log(`Text: "${text}"`);
  console.log(`Voice: ${voice}\n`);

  // Create TTS instance
  console.log('Creating TTS instance...');
  const tts = await TTS.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      synthesisConfig: {
        inworldConfig: {
          modelId: 'inworld-tts-1-max',
          inference: {
            temperature: 0.8,
            speakingRate: 1.0,
          },
          postprocessing: {
            sampleRate: 24000,
          },
        },
      },
    } as any,
  });
  console.log('TTS instance created!\n');

  // Synthesize speech
  console.log('Synthesizing speech...');
  const startTime = Date.now();

  const audio = await tts.synthesizeSpeechComplete({
    voice: { id: voice },
    text,
  } as any);

  const duration = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('Synthesis complete!');
  console.log(`  • Duration: ${duration}ms`);
  console.log(`  • Samples: ${audio.data?.length || 0}`);
  console.log(`  • Sample rate: ${audio.sampleRate}Hz`);
  console.log(
    `  • Audio length: ${((audio.data?.length || 0) / audio.sampleRate).toFixed(2)}s`,
  );
  console.log('─'.repeat(60));

  // Save to WAV file
  if (audio.data) {
    await saveAudioToWav(
      { data: audio.data, sampleRate: audio.sampleRate },
      path.join(outputDir, 'basic_output.wav'),
    );
  } else {
    console.log('⚠️  No audio data received');
  }
}

/**
 * Streaming example - Show audio chunks as they arrive
 *
 * @param {string} text - Text to synthesize
 * @param {string} voice - Voice ID
 * @param {string} outputDir - Output directory
 * @param {string} apiKey - API key
 */
async function runStreamingExample(
  text: string,
  voice: string,
  outputDir: string,
  apiKey: string,
) {
  console.log('\n=== Streaming TTS Example ===\n');

  console.log(`Text: "${text}"`);
  console.log(`Voice: ${voice}\n`);

  const tts = await TTS.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      synthesisConfig: {
        inworldConfig: {
          modelId: 'inworld-tts-1-max',
          inference: {
            temperature: 0.8,
            speakingRate: 1.0,
          },
          postprocessing: {
            sampleRate: 24000,
          },
        },
      },
    } as any,
  });

  console.log('Synthesizing speech (streaming)...');
  console.log('─'.repeat(60));

  const stream = await tts.synthesizeSpeech({
    voice: { id: voice },
    text,
  } as any);

  const chunks: Float32Array[] = [];
  let chunkCount = 0;
  let sampleRate = 0;
  const startTime = Date.now();

  for await (const audioChunk of stream) {
    chunkCount++;
    chunks.push(audioChunk.data);
    if (sampleRate === 0) {
      sampleRate = audioChunk.sampleRate;
    }
    console.log(
      `Chunk ${chunkCount}: ${audioChunk.data.length} samples at ${audioChunk.sampleRate}Hz`,
    );
  }

  const duration = Date.now() - startTime;

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, arr) => sum + arr.length, 0);
  const fullAudio = new Float32Array(new ArrayBuffer(totalLength * 4));
  let offset = 0;
  for (const chunk of chunks) {
    fullAudio.set(chunk, offset);
    offset += chunk.length;
  }

  console.log('─'.repeat(60));
  console.log('\nStreaming Statistics:');
  console.log(`  • Chunks received: ${chunkCount}`);
  console.log(`  • Duration: ${duration}ms`);
  console.log(`  • Total samples: ${totalLength}`);
  console.log(`  • Sample rate: ${sampleRate}Hz`);
  console.log(`  • Audio length: ${(totalLength / sampleRate).toFixed(2)}s`);

  // Save to WAV file
  if (fullAudio.length > 0) {
    await saveAudioToWav(
      { data: fullAudio, sampleRate },
      path.join(outputDir, 'streaming_output.wav'),
    );
  } else {
    console.log('⚠️  No audio data received');
  }
}

/**
 * Voices example - Synthesize with different voices
 *
 * @param {string} text - Text to synthesize
 * @param {string} outputDir - Output directory
 * @param {string} apiKey - API key
 */
async function runVoicesExample(
  text: string,
  outputDir: string,
  apiKey: string,
) {
  console.log('\n=== Different Voices Example ===\n');

  console.log(`Text: "${text}"\n`);

  const tts = await TTS.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      synthesisConfig: {
        inworldConfig: {
          modelId: 'inworld-tts-1-max',
          inference: {
            temperature: 0.8,
            speakingRate: 1.0,
          },
          postprocessing: {
            sampleRate: 24000,
          },
        },
      },
    } as any,
  });

  // Try different voices
  const voices = [
    { id: 'Ashley', name: 'Ashley - Warm, natural female voice' },
    { id: 'Dennis', name: 'Dennis - Smooth, calm male voice' },
    { id: 'Olivia', name: 'Olivia - Young British female, upbeat' },
    { id: 'Shaun', name: 'Shaun - Friendly, dynamic male voice' },
  ];

  console.log('Synthesizing with different voices:\n');

  for (const voice of voices) {
    console.log(`Voice: ${voice.name} (${voice.id})`);
    console.log('─'.repeat(60));

    try {
      const startTime = Date.now();

      const audio = await tts.synthesizeSpeechComplete({
        voice: { id: voice.id },
        text,
      } as any);

      const duration = Date.now() - startTime;

      console.log(`  ✓ Synthesized in ${duration}ms`);
      console.log(`  • Samples: ${audio.data?.length || 0}`);
      console.log(`  • Sample rate: ${audio.sampleRate}Hz`);
      console.log(
        `  • Duration: ${((audio.data?.length || 0) / audio.sampleRate).toFixed(2)}s`,
      );

      // Save to WAV file
      const filename = `voice_${voice.id.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
      if (audio.data) {
        await saveAudioToWav(
          { data: audio.data, sampleRate: audio.sampleRate },
          path.join(outputDir, filename),
        );
        console.log(`  • Saved to: ${filename}`);
      } else {
        console.log(`  ⚠️  No audio data received`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }

    console.log();
  }
}

/**
 * Batch example - Synthesize multiple texts
 *
 * @param {string} voice - Voice ID
 * @param {string} outputDir - Output directory
 * @param {string} apiKey - API key
 */
async function runBatchExample(
  voice: string,
  outputDir: string,
  apiKey: string,
) {
  console.log('\n=== Batch Synthesis Example ===\n');

  console.log(`Voice: ${voice}\n`);

  const tts = await TTS.create({
    remoteConfig: {
      apiKey,
      defaultTimeout: { seconds: 30 },
      synthesisConfig: {
        inworldConfig: {
          modelId: 'inworld-tts-1-max',
          inference: {
            temperature: 0.8,
            speakingRate: 1.0,
          },
          postprocessing: {
            sampleRate: 24000,
          },
        },
      },
    } as any,
  });

  // Multiple texts to synthesize
  const texts = [
    'Hello, welcome to our service.',
    'How can I help you today?',
    'Thank you for using our text-to-speech system.',
    'Have a great day!',
  ];

  console.log(`Synthesizing ${texts.length} texts...\n`);

  const results: Array<{ text: string; audio: any; duration: number }> = [];

  for (let i = 0; i < texts.length; i++) {
    console.log(`Text ${i + 1}/${texts.length}: "${texts[i]}"`);

    try {
      const startTime = Date.now();

      const audio = await tts.synthesizeSpeechComplete({
        voice: { id: voice },
        text: texts[i],
      } as any);

      const duration = Date.now() - startTime;

      results.push({ text: texts[i], audio, duration });

      console.log(`  ✓ Synthesized in ${duration}ms`);
      console.log(`  • Samples: ${audio.data?.length || 0}`);
      console.log(
        `  • Duration: ${((audio.data?.length || 0) / audio.sampleRate).toFixed(2)}s`,
      );

      // Save individual file
      const filename = `batch_${i + 1}.wav`;
      if (audio.data) {
        await saveAudioToWav(
          { data: audio.data, sampleRate: audio.sampleRate },
          path.join(outputDir, filename),
        );
        console.log(`  • Saved to: ${filename}`);
      } else {
        console.log(`  ⚠️  No audio data received`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }

    console.log();
  }

  // Concatenate all audio files into one
  if (results.length > 0 && results[0].audio.data) {
    console.log('Creating combined audio file...');

    const sampleRate = results[0].audio.sampleRate;
    const silenceDuration = 0.5; // 0.5 seconds of silence between segments
    const silenceSamples = Math.floor(silenceDuration * sampleRate);
    const silence = new Float32Array(new ArrayBuffer(silenceSamples * 4));

    // Calculate total length (only for results with data)
    const totalLength = results.reduce(
      (sum, result) => sum + (result.audio.data?.length || 0) + silenceSamples,
      0,
    );

    const combined = new Float32Array(new ArrayBuffer(totalLength * 4));
    let offset = 0;

    for (const result of results) {
      if (result.audio.data) {
        combined.set(result.audio.data, offset);
        offset += result.audio.data.length;
        combined.set(silence, offset);
        offset += silenceSamples;
      }
    }

    if (combined.length > 0) {
      await saveAudioToWav(
        { data: combined, sampleRate },
        path.join(outputDir, 'batch_combined.wav'),
      );

      console.log('─'.repeat(60));
      console.log('Batch Statistics:');
      console.log(`  • Total texts: ${results.length}`);
      console.log(
        `  • Total synthesis time: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`,
      );
      console.log(
        `  • Combined audio length: ${(totalLength / sampleRate).toFixed(2)}s`,
      );
      console.log(`  • Combined file: batch_combined.wav`);
    }
  }
}

/**
 * Save audio to WAV file
 *
 * @param {any} audio - Audio data with data and sampleRate (data is required)
 * @param {string} outputPath - Output file path
 */
async function saveAudioToWav(
  audio: { data: Float32Array; sampleRate: number },
  outputPath: string,
): Promise<void> {
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert Float32Array to proper format for wav-encoder
  // Create a new Float32Array with explicit ArrayBuffer
  const audioData = new Float32Array(new ArrayBuffer(audio.data.length * 4));
  audioData.set(audio.data);

  const audioObject = {
    sampleRate: audio.sampleRate,
    channelData: [audioData],
  };

  const buffer = await wavEncoder.encode(audioObject);
  fs.writeFileSync(outputPath, Buffer.from(buffer));

  console.log(`✓ Audio saved to: ${outputPath}`);
}

function parseArgs(): {
  mode: string;
  text: string;
  voice: string;
  outputDir: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'basic';
  const text =
    argv.text ||
    argv._?.join(' ') ||
    'Hello! This is a text-to-speech demonstration using the Inworld SDK.';
  const voice = argv.voice || 'Ashley';
  const outputDir =
    argv.outputDir || path.join(__dirname, '..', '..', 'data-output', 'tts');
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { mode, text, voice, outputDir, apiKey };
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
