import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { float32ToBytes, InworldError } from '@inworld/runtime/common';
import { DeviceType } from '@inworld/runtime/core';
import { TurnDetector } from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const usage = `
Usage:
    npm run basic-turn-detector -- \n
    --mode=basic|monitoring|batch|thresholds[optional, default=basic] \n
    --audioFile=<path-to-audio-file>[optional, uses fixtures/stt/audio.wav] \n
    --modelPath=<path-to-model>[optional, uses default model path] \n
    --threshold=<confidence-threshold>[optional, default=0.7]
    
Note: Requires turn detection model file (pipecat_smart_turn_v3.onnx)
      Default location: src/shared/models/turn_detection/pipecat_smart_turn_v3.onnx`;

run();

async function run() {
  const { mode, audioFile, modelPath, threshold } = parseArgs();

  try {
    switch (mode) {
      case 'basic':
        await runBasicExample(audioFile, modelPath, threshold);
        break;
      case 'monitoring':
        await runMonitoringExample(audioFile, modelPath, threshold);
        break;
      case 'batch':
        await runBatchExample(audioFile, modelPath, threshold);
        break;
      case 'thresholds':
        await runThresholdsExample(audioFile, modelPath);
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
 * Basic turn detection example - Analyze audio chunks for turn completion
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} modelPath - Path to turn detection model
 * @param {number} threshold - Confidence threshold
 */
async function runBasicExample(
  audioFile: string,
  modelPath: string,
  threshold: number,
) {
  console.log('\n=== Basic Turn Detection Example ===\n');

  console.log(`Audio file: ${audioFile}`);
  console.log(`Model: ${modelPath}`);
  console.log(`Threshold: ${threshold}\n`);

  // Create TurnDetector instance
  console.log('Creating TurnDetector instance...');
  const turnDetector = await TurnDetector.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { threshold },
    },
  });
  console.log('TurnDetector instance created!\n');

  // Load audio file
  const audioData = await loadAudioFile(audioFile);
  console.log(`Loaded audio: ${audioData.duration.toFixed(2)}s\n`);

  // Split audio into chunks (500ms each)
  const chunkSize = Math.floor(audioData.sampleRate * 0.5);
  const chunks = splitAudioIntoChunks(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
  );

  console.log(`Processing ${chunks.length} audio chunks...\n`);
  console.log('─'.repeat(60));

  let turnDetectedCount = 0;
  const results: Array<{ chunk: number; result: any; time: number }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkTime = (i * chunkSize) / audioData.sampleRate;
    const result = await turnDetector.detectTurnCompletion(chunks[i], {
      threshold,
    });

    results.push({
      chunk: i + 1,
      result,
      time: chunkTime,
    });

    const predictionLabel = result.prediction === 1 ? 'TURN_END' : 'SPEAKING';
    const confidence = (result.probability * 100).toFixed(1);

    console.log(
      `[${chunkTime.toFixed(2)}s] Chunk ${i + 1}/${chunks.length}: ${predictionLabel} (confidence: ${confidence}%)`,
    );

    if (result.prediction === 1) {
      turnDetectedCount++;
      if (result.probability >= threshold) {
        console.log(`  ✓ High confidence turn completion detected!`);
      }
    }
  }

  console.log('─'.repeat(60));
  console.log('\nSummary:');
  console.log(`  • Total chunks: ${chunks.length}`);
  console.log(`  • Turn completions detected: ${turnDetectedCount}`);
  console.log(
    `  • Above threshold (${threshold}): ${results.filter((r) => r.result.prediction === 1 && r.result.probability >= threshold).length}`,
  );

  // Find strongest turn signal
  const strongest = results.reduce((max, current) =>
    current.result.probability > max.result.probability ? current : max,
  );
  console.log(
    `  • Strongest signal: Chunk ${strongest.chunk} (${(strongest.result.probability * 100).toFixed(1)}%)`,
  );
}

/**
 * Real-time monitoring example - Stream audio and monitor for turn completion
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} modelPath - Path to turn detection model
 * @param {number} threshold - Confidence threshold
 */
async function runMonitoringExample(
  audioFile: string,
  modelPath: string,
  threshold: number,
) {
  console.log('\n=== Real-time Monitoring Example ===\n');

  console.log('Simulating real-time turn detection...\n');

  const turnDetector = await TurnDetector.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { threshold },
    },
  });

  const audioData = await loadAudioFile(audioFile);
  console.log(`Audio duration: ${audioData.duration.toFixed(2)}s\n`);

  // Create audio stream with smaller chunks (250ms)
  const chunkSize = Math.floor(audioData.sampleRate * 0.25);
  const audioStream = createAudioStream(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
  );

  console.log('Monitoring audio stream for turn completion...');
  console.log(`Threshold: ${threshold}\n`);
  console.log('─'.repeat(60));

  const startTime = Date.now();
  let chunkCount = 0;
  let turnDetected = false;

  try {
    for await (const result of turnDetector.monitorTurns(audioStream, {
      threshold,
    })) {
      chunkCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const confidence = (result.probability * 100).toFixed(1);

      if (result.prediction === 1) {
        console.log(
          `[${elapsed}s] Chunk ${chunkCount}: ⚠️  TURN_END (${confidence}%)`,
        );

        if (result.probability >= threshold) {
          console.log(`  🎯 HIGH CONFIDENCE - Turn is complete!`);
          turnDetected = true;
          break; // Stop monitoring after high-confidence detection
        }
      } else {
        console.log(
          `[${elapsed}s] Chunk ${chunkCount}: 🗣️  SPEAKING (${confidence}%)`,
        );
      }
    }
  } catch (error) {
    console.log(`\nMonitoring stopped: ${error.message}`);
  }

  console.log('─'.repeat(60));
  console.log('\nMonitoring Results:');
  console.log(`  • Chunks processed: ${chunkCount}`);
  console.log(`  • Turn detected: ${turnDetected ? 'Yes' : 'No'}`);
  console.log(`  • Processing time: ${Date.now() - startTime}ms`);

  if (turnDetected) {
    console.log('\n✓ Turn completion successfully detected!');
    console.log('  In a real application, this would trigger:');
    console.log('  - Stop speaking/generating response');
    console.log('  - Switch to listening mode');
    console.log('  - Allow other party to respond');
  }
}

/**
 * Batch processing example - Process multiple chunks and analyze patterns
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} modelPath - Path to turn detection model
 * @param {number} threshold - Confidence threshold
 */
async function runBatchExample(
  audioFile: string,
  modelPath: string,
  threshold: number,
) {
  console.log('\n=== Batch Processing Example ===\n');

  const turnDetector = await TurnDetector.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { threshold },
    },
  });

  const audioData = await loadAudioFile(audioFile);

  // Create chunks
  const chunkSize = Math.floor(audioData.sampleRate * 0.5);
  const chunks = splitAudioIntoChunks(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
  );

  console.log(`Processing ${chunks.length} chunks in batch...\n`);

  const startTime = Date.now();
  const results = await turnDetector.detectBatch(chunks, { threshold });
  const duration = Date.now() - startTime;

  console.log('─'.repeat(60));
  console.log('Batch Results:');
  console.log('─'.repeat(60));

  results.forEach((result, i) => {
    const chunkTime = (i * chunkSize) / audioData.sampleRate;
    const prediction = result.prediction === 1 ? 'TURN_END' : 'SPEAKING ';
    const confidence = (result.probability * 100).toFixed(1);
    const indicator =
      result.prediction === 1 && result.probability >= threshold ? '🎯' : '  ';

    console.log(
      `${indicator} Chunk ${(i + 1).toString().padStart(2)}: [${chunkTime.toFixed(2)}s] ${prediction} ${confidence}%`,
    );
  });

  console.log('─'.repeat(60));

  // Analyze results
  const turnPredictions = results.filter((r) => r.prediction === 1);
  const highConfidence = turnPredictions.filter(
    (r) => r.probability >= threshold,
  );
  const avgProbability =
    results.reduce((sum, r) => sum + r.probability, 0) / results.length;

  console.log('\nAnalysis:');
  console.log(`  • Processing time: ${duration}ms`);
  console.log(
    `  • Throughput: ${(chunks.length / (duration / 1000)).toFixed(1)} chunks/sec`,
  );
  console.log(
    `  • Turn predictions: ${turnPredictions.length}/${results.length}`,
  );
  console.log(`  • High confidence: ${highConfidence.length}`);
  console.log(`  • Average probability: ${(avgProbability * 100).toFixed(1)}%`);

  // Find strongest signal
  const strongest = await turnDetector.getStrongestSignal(chunks, {
    threshold,
  });
  console.log(
    `  • Strongest signal: ${(strongest.probability * 100).toFixed(1)}%`,
  );

  // Probability distribution
  const histogram = {
    low: results.filter((r) => r.probability < 0.3).length,
    medium: results.filter((r) => r.probability >= 0.3 && r.probability < 0.7)
      .length,
    high: results.filter((r) => r.probability >= 0.7).length,
  };

  console.log('\nProbability Distribution:');
  console.log(`  • Low (< 0.3):    ${histogram.low} chunks`);
  console.log(`  • Medium (0.3-0.7): ${histogram.medium} chunks`);
  console.log(`  • High (> 0.7):   ${histogram.high} chunks`);
}

/**
 * Threshold comparison example - Test different confidence thresholds
 *
 * @param {string} audioFile - Path to audio file
 * @param {string} modelPath - Path to turn detection model
 */
async function runThresholdsExample(audioFile: string, modelPath: string) {
  console.log('\n=== Threshold Comparison Example ===\n');

  console.log('Testing different confidence thresholds...\n');

  const turnDetector = await TurnDetector.create({
    localConfig: {
      modelPath,
      device: { type: DeviceType.CPU, index: 0 },
      defaultConfig: { threshold: 0.5 },
    },
  });

  const audioData = await loadAudioFile(audioFile);

  // Create chunks
  const chunkSize = Math.floor(audioData.sampleRate * 0.5);
  const chunks = splitAudioIntoChunks(
    audioData.channelData[0],
    audioData.sampleRate,
    chunkSize,
  );

  // Get all results once
  console.log('Processing all chunks...');
  const allResults = await turnDetector.detectBatch(chunks);
  console.log(`✓ Processed ${chunks.length} chunks\n`);

  // Test different thresholds
  const thresholds = [0.5, 0.6, 0.7, 0.8, 0.9];

  console.log('─'.repeat(60));
  console.log('Threshold Analysis:');
  console.log('─'.repeat(60));

  for (const threshold of thresholds) {
    const turnDetections = allResults.filter(
      (r) => r.prediction === 1 && r.probability >= threshold,
    );

    const avgConfidence =
      turnDetections.length > 0
        ? (turnDetections.reduce((sum, r) => sum + r.probability, 0) /
            turnDetections.length) *
          100
        : 0;

    console.log(`\nThreshold: ${threshold.toFixed(1)}`);
    console.log(`  • Turn detections: ${turnDetections.length}`);
    console.log(`  • Avg confidence: ${avgConfidence.toFixed(1)}%`);

    if (turnDetections.length > 0) {
      const firstDetection = allResults.findIndex(
        (r) => r.prediction === 1 && r.probability >= threshold,
      );
      const timeOfFirst = (firstDetection * chunkSize) / audioData.sampleRate;
      console.log(`  • First detection at: ${timeOfFirst.toFixed(2)}s`);
    }

    // Characterize threshold
    let description = '';
    if (threshold <= 0.5) {
      description = 'Very sensitive - may have false positives';
    } else if (threshold <= 0.6) {
      description = 'Sensitive - quick detection';
    } else if (threshold <= 0.7) {
      description = 'Balanced - good for most use cases';
    } else if (threshold <= 0.8) {
      description = 'Conservative - fewer false positives';
    } else {
      description = 'Very conservative - high confidence required';
    }
    console.log(`  • Behavior: ${description}`);
  }

  console.log('─'.repeat(60));
  console.log('\nRecommendations:');
  console.log('  • 0.5-0.6: Use for quick, responsive systems');
  console.log('  • 0.7: Good default for most applications');
  console.log('  • 0.8-0.9: Use when false positives are costly');
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
 * Split audio into chunks
 *
 * @param {Float32Array} fullAudio - Complete audio data
 * @param {number} sampleRate - Sample rate
 * @param {number} chunkSize - Size of each chunk in samples
 * @returns {Array<any>} Array of audio chunks
 */
function splitAudioIntoChunks(
  fullAudio: Float32Array,
  sampleRate: number,
  chunkSize: number,
): Array<any> {
  const chunks: Array<any> = [];

  for (let i = 0; i < fullAudio.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, fullAudio.length);
    const length = end - i;

    const chunk = new Float32Array(new ArrayBuffer(length * 4));
    chunk.set(fullAudio.subarray(i, end));

    chunks.push({
      data: float32ToBytes(chunk),
      sampleRate,
    });
  }

  return chunks;
}

/**
 * Create audio stream generator
 *
 * @param {Float32Array} fullAudio - Complete audio data
 * @param {number} sampleRate - Sample rate
 * @param {number} chunkSize - Size of each chunk in samples
 * @returns {AsyncIterable<any>} Audio stream
 */
async function* createAudioStream(
  fullAudio: Float32Array,
  sampleRate: number,
  chunkSize: number,
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
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function parseArgs(): {
  mode: string;
  audioFile: string;
  modelPath: string;
  threshold: number;
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
  const modelPath =
    argv.modelPath ||
    path.join(
      __dirname,
      '..',
      'shared',
      'models',
      'turn_detection',
      'pipecat_smart_turn_v3.onnx',
    );
  const threshold = argv.threshold || 0.7;

  // Check if model file exists
  if (!fs.existsSync(modelPath)) {
    console.error(`\n❌ Turn detection model not found: ${modelPath}`);
    console.error('\nPlease ensure the model file is available.');
    console.error('The model is located in:');
    console.error(
      '  src/shared/models/turn_detection/pipecat_smart_turn_v3.onnx\n',
    );
    process.exit(1);
  }

  return { mode, audioFile, modelPath, threshold };
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
