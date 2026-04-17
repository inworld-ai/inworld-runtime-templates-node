/**
 * Turn Detector in Custom Graph Node Example
 *
 * Demonstrates using context.getTurnDetectorInterface() inside a CustomNode
 * to detect turn completion via the graph component registry.
 *
 * Usage:
 *   npm run node-turn-detector-custom -- --audioFilePath=<path-to-audio.wav>
 */

import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  LocalTurnDetectorComponent,
  ProcessContext,
} from '@inworld/runtime/graph';
import * as fs from 'fs';
import * as path from 'path';

const minimist = require('minimist');
const WavDecoder = require('wav-decoder');

const TURN_DETECTOR_COMPONENT_ID = 'local_turn_detector';
const DEFAULT_TURN_DETECTOR_MODEL_PATH = path.join(
  __dirname,
  '..',
  'shared',
  'models',
  'turn_detection',
  'pipecat_smart_turn_v3.onnx',
);

const usage = `
Usage:
    npm run node-turn-detector-custom -- --audioFilePath=<path-to-audio.wav> [options]

Options:
    --audioFilePath=<path>            Path to WAV audio file (required)
    --turnDetectorModelPath=<path>    Path to turn detector model
    --help                            Show this help message

Description:
    Demonstrates using context.getTurnDetectorInterface() inside a custom graph
    node to detect turn completion through the graph component registry.
`;

/**
 * Custom node that uses the TurnDetector interface from ProcessContext.
 * Receives the audio file path as input and loads + processes it internally.
 */
class TurnDetectorCustomNode extends CustomNode {
  async process(context: ProcessContext, ...inputs: any[]): Promise<string> {
    // Unwrap string input from graph serialization
    let audioFilePath = inputs[0];
    while (
      audioFilePath &&
      typeof audioFilePath === 'object' &&
      'value' in audioFilePath
    ) {
      audioFilePath = audioFilePath.value;
    }

    // Load and decode audio inside the node
    const audioBuffer = fs.readFileSync(audioFilePath as string);
    const decoded = await WavDecoder.decode(audioBuffer);
    const sampleRate = decoded.sampleRate;
    const float32Data = decoded.channelData[0] as Float32Array;

    const pcm16 = Buffer.alloc(float32Data.length * 2);
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      pcm16.writeInt16LE(
        s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff),
        i * 2,
      );
    }

    const td = context.getTurnDetectorInterface(TURN_DETECTOR_COMPONENT_ID);

    console.log('Template: Detecting turn completion via ProcessContext...');

    // Process audio in chunks (500ms each)
    const chunkMs = 500;
    const chunkSamples = Math.round((sampleRate * chunkMs) / 1000);
    const bytesPerSample = 2; // PCM16
    const chunkBytes = chunkSamples * bytesPerSample;
    const totalChunks = Math.ceil(pcm16.length / chunkBytes);
    const chunksToProcess = Math.min(totalChunks, 5);

    console.log(
      `Template: Processing ${chunksToProcess} chunks of ${chunkMs}ms each`,
    );

    let highestProbability = 0;
    for (let i = 0; i < chunksToProcess; i++) {
      const start = i * chunkBytes;
      const end = Math.min(start + chunkBytes, pcm16.length);
      const chunk = pcm16.subarray(start, end) as Buffer;

      const prediction = await td.detectTurnCompletion({
        data: chunk,
        sampleRate,
      });

      console.log(
        `Template: Chunk ${i + 1}: status=${prediction.status}, probability=${prediction.probability.toFixed(3)}`,
      );

      if (prediction.probability > highestProbability) {
        highestProbability = prediction.probability;
      }
    }

    const result = `Highest turn probability: ${highestProbability.toFixed(3)}`;
    console.log(`Template: ${result}`);
    return result;
  }
}

run();

async function run() {
  const { audioFilePath, turnDetectorModelPath } = parseArgs();

  console.log('Template: === Turn Detector in Custom Graph Node ===');
  console.log(`Template: Audio: ${path.basename(audioFilePath)}`);

  // Build graph with TurnDetector component
  const turnDetectorComponent = new LocalTurnDetectorComponent({
    id: TURN_DETECTOR_COMPONENT_ID,
    modelPath: turnDetectorModelPath,
  });

  const turnDetectorNode = new TurnDetectorCustomNode({
    id: 'turn_detector_custom_node',
  });

  const graph = new GraphBuilder({
    id: 'turn_detector_custom_node_graph',
    apiKey: process.env.INWORLD_API_KEY || '',
    enableRemoteConfig: false,
  })
    .addComponent(turnDetectorComponent)
    .addNode(turnDetectorNode)
    .setStartNode(turnDetectorNode)
    .setEndNode(turnDetectorNode)
    .build();

  try {
    // Pass the file path as a string — binary data doesn't survive graph serialization
    const { outputStream } = await graph.start(audioFilePath);

    for await (const result of outputStream) {
      const data = result.data;
      const value = (data as any)?.value ?? data;
      console.log(`Template: Graph Output: ${value}`);
    }
  } catch (error: any) {
    console.error('Graph error:', error.message);
  }

  stopInworldRuntime();
}

function parseArgs(): {
  audioFilePath: string;
  turnDetectorModelPath: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const audioFilePath =
    argv.audioFilePath ||
    path.join(__dirname, '..', 'shared', 'fixtures', 'vad', 'audio.wav');
  const turnDetectorModelPath =
    argv.turnDetectorModelPath || DEFAULT_TURN_DETECTOR_MODEL_PATH;

  if (!fs.existsSync(audioFilePath)) {
    console.error(`Audio file not found: ${audioFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(turnDetectorModelPath)) {
    console.error(`Turn detector model not found: ${turnDetectorModelPath}`);
    process.exit(1);
  }

  return { audioFilePath, turnDetectorModelPath };
}
