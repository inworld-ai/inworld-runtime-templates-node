/**
 * VAD in Custom Graph Node Example
 *
 * Demonstrates using context.getVADInterface() inside a CustomNode
 * to detect voice activity via the graph component registry.
 *
 * Usage:
 *   npm run node-vad-custom -- --audioFilePath=<path-to-audio.wav>
 */

import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  LocalVADComponent,
  ProcessContext,
} from '@inworld/runtime/graph';
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_VAD_MODEL_PATH } from '../shared/constants';

const minimist = require('minimist');
const WavDecoder = require('wav-decoder');

const VAD_COMPONENT_ID = 'local_vad';

const usage = `
Usage:
    npm run node-vad-custom -- --audioFilePath=<path-to-audio.wav> [options]

Options:
    --audioFilePath=<path>    Path to WAV audio file (required)
    --vadModelPath=<path>     Path to VAD model (default: shared/models/silero_vad.onnx)
    --help                    Show this help message

Description:
    Demonstrates using context.getVADInterface() inside a custom graph node
    to detect voice activity through the graph component registry.
`;

/**
 * Custom node that uses the VAD interface from ProcessContext.
 * Receives the audio file path as input and loads + processes it internally.
 */
class VADCustomNode extends CustomNode {
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

    const vad = context.getVADInterface(VAD_COMPONENT_ID);

    console.log('Template: Detecting voice activity via ProcessContext...');
    const speechIndex = await vad.detectVoiceActivity({
      data: pcm16,
      sampleRate,
    });

    const status =
      speechIndex >= 0
        ? `Speech detected at sample ${speechIndex}`
        : 'No speech detected';

    console.log(`Template: VAD Result: ${status}`);

    console.log('Template: Detecting silence intervals...');
    const silenceIntervals = await vad.detectSilence(pcm16, sampleRate);
    console.log(
      `Template: Found ${silenceIntervals.length} silence interval(s)`,
    );

    return status;
  }
}

run();

async function run() {
  const { audioFilePath, vadModelPath } = parseArgs();

  console.log('Template: === VAD in Custom Graph Node ===');
  console.log(`Template: Audio: ${path.basename(audioFilePath)}`);

  // Build graph with VAD component
  const vadComponent = new LocalVADComponent({
    id: VAD_COMPONENT_ID,
    modelPath: vadModelPath,
  });

  const vadNode = new VADCustomNode({ id: 'vad_custom_node' });

  const graph = new GraphBuilder({
    id: 'vad_custom_node_graph',
    apiKey: process.env.INWORLD_API_KEY || '',
    enableRemoteConfig: false,
  })
    .addComponent(vadComponent)
    .addNode(vadNode)
    .setStartNode(vadNode)
    .setEndNode(vadNode)
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

function parseArgs(): { audioFilePath: string; vadModelPath: string } {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const audioFilePath =
    argv.audioFilePath ||
    path.join(__dirname, '..', 'shared', 'fixtures', 'vad', 'audio.wav');
  const vadModelPath = argv.vadModelPath || DEFAULT_VAD_MODEL_PATH;

  if (!fs.existsSync(audioFilePath)) {
    console.error(`Audio file not found: ${audioFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(vadModelPath)) {
    console.error(`VAD model not found: ${vadModelPath}`);
    process.exit(1);
  }

  return { audioFilePath, vadModelPath };
}
