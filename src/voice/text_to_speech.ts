import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import * as fs from 'fs';
import * as path from 'path';

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');

import {
  GraphBuilder,
  GraphTypes,
  RemoteTTSNode,
} from '@inworld/runtime/graph';

import {
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VOICE_ID,
  SAMPLE_RATE,
} from '../shared/constants';

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  'data-output',
  'tts_samples',
);
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'node_tts_output.wav');

const usage = `
Usage:
    npm run node-tts "Hello, how can I help you?" -- \n
    --modelId=<model-id>[optional, ${DEFAULT_TTS_MODEL_ID} will be used by default] \n
    --voiceName=<voice-id>[optional, ${DEFAULT_VOICE_ID} will be used by default]`;

run();

async function run() {
  const { text, modelId, voiceName, apiKey } = parseArgs();

  const ttsNode = new RemoteTTSNode({
    id: 'tts_node',
    speakerId: voiceName,
    modelId,
    sampleRate: 24000,
    temperature: 0.8,
    speakingRate: 1,
  });

  const graph = new GraphBuilder({
    id: 'node_tts_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(ttsNode)
    .setStartNode(ttsNode)
    .setEndNode(ttsNode)
    .build();

  const { outputStream } = await graph.start(text);
  let initialText = '';
  let resultCount = 0;
  const audioBuffers: Buffer[] = [];

  for await (const result of outputStream) {
    await result.processResponse({
      TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
        for await (const chunk of ttsStream) {
          if (chunk.text) initialText += chunk.text;
          if (chunk.audio?.data) {
            const buffer = Buffer.from(chunk.audio?.data, 'base64');
            audioBuffers.push(buffer);
          }
          resultCount++;
        }
      },
    });
  }

  console.log(`Result count: ${resultCount}`);
  console.log(`Initial text: ${initialText}`);

  const mergedBuffer = Buffer.concat(audioBuffers);
  const floatSamples = new Float32Array(
    mergedBuffer.buffer,
    mergedBuffer.byteOffset,
    mergedBuffer.length / 4,
  );

  // Create a single audio object with all the data
  const audio = {
    sampleRate: SAMPLE_RATE, // default sample rate
    channelData: [floatSamples],
  };

  // Encode and write all the audio data to a single file
  const buffer = await wavEncoder.encode(audio);
  if (!fs.existsSync(OUTPUT_DIRECTORY)) {
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, Buffer.from(buffer));

  console.log(`Audio saved to ${OUTPUT_PATH}`);
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
  modelId: string;
  voiceName: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const text = argv._?.join(' ') || '';
  const modelId = argv.modelId || DEFAULT_TTS_MODEL_ID;
  const voiceName = argv.voiceName || DEFAULT_VOICE_ID;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { text, modelId, voiceName, apiKey };
}
