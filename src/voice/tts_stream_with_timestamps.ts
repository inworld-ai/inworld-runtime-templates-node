import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteTTSNode,
  TextChunkingNode,
} from '@inworld/runtime/graph';
import {
  AudioChunkTimestamp,
  TimestampType,
} from '@inworld/runtime/primitives/speech';
import * as fs from 'fs';
import * as path from 'path';

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');

import { DEFAULT_TTS_MODEL_ID, DEFAULT_VOICE_ID } from '../shared/constants';
import { exitWithError } from '../shared/helpers/cli_helpers';

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  'data-output',
  'tts_samples',
);
const OUTPUT_AUDIO_PATH = path.join(
  OUTPUT_DIRECTORY,
  'tts_stream_timestamps_output.wav',
);
const OUTPUT_TIMESTAMP_PATH = path.join(
  OUTPUT_DIRECTORY,
  'tts_stream_timestamps.json',
);
const SAMPLE_RATE = 24000;

const usage = `
Usage:
    npm run node-tts-stream-timestamps "Hello, how can I help you?" -- \n
    --modelId=<model-id>[optional, ${DEFAULT_TTS_MODEL_ID} will be used by default] \n
    --voiceName=<voice-id>[optional, ${DEFAULT_VOICE_ID} will be used by default]`;

/**
 * CustomNode that builds a TTSRequest from a TextStream with explicit
 * synthesis config -- mirrors the pattern used in the platform's
 * TTSRequestBuilderNode for long-running graphs where voice/model
 * config may be resolved dynamically at processing time.
 */
class TTSRequestBuilderNode extends CustomNode {
  private voiceId: string;
  private ttsModelId: string;

  constructor(props: { id: string; voiceId: string; ttsModelId: string }) {
    super({ id: props.id });
    this.voiceId = props.voiceId;
    this.ttsModelId = props.ttsModelId;
  }

  process(
    _context: ProcessContext,
    textStream: GraphTypes.TextStream,
  ): GraphTypes.TTSRequest {
    return GraphTypes.TTSRequest.withStream(
      textStream,
      { id: this.voiceId },
      {
        modelId: this.ttsModelId,
        postprocessing: {
          sampleRate: SAMPLE_RATE,
        },
        inference: {
          temperature: 1.0,
          speakingRate: 1,
        },
        timestampType: TimestampType.Word,
      },
    );
  }
}

run();

async function run() {
  const { text, modelId, voiceName, apiKey } = parseArgs();

  const textChunkingNode = new TextChunkingNode({ id: 'text_chunking' });

  const ttsRequestBuilder = new TTSRequestBuilderNode({
    id: 'tts_request_builder',
    voiceId: voiceName,
    ttsModelId: modelId,
  });

  const ttsNode = new RemoteTTSNode({
    id: 'tts_node',
  });

  const graph = new GraphBuilder({
    id: 'tts_stream_timestamps_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(textChunkingNode)
    .addNode(ttsRequestBuilder)
    .addNode(ttsNode)
    .addEdge(textChunkingNode, ttsRequestBuilder)
    .addEdge(ttsRequestBuilder, ttsNode)
    .setStartNode(textChunkingNode)
    .setEndNode(ttsNode)
    .build();

  const { outputStream } = await graph.start(text);

  let initialText = '';
  let resultCount = 0;
  const audioBuffers: Buffer[] = [];
  const timestamps: AudioChunkTimestamp[] = [];

  for await (const result of outputStream) {
    await result.processResponse({
      TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
        for await (const chunk of ttsStream) {
          if (chunk.text) initialText += chunk.text;
          if (chunk.audio?.data) {
            audioBuffers.push(chunk.audio.data);
          }
          timestamps.push(...chunk.timestamps);
          resultCount++;
        }
      },
    });
  }

  console.log(`Result count: ${resultCount}`);
  console.log(`Initial text: ${initialText}`);
  console.log(`Timestamps collected: ${timestamps.length}`);

  for (const ts of timestamps) {
    console.log(
      `  [${ts.startTime.toFixed(3)}s - ${ts.endTime.toFixed(3)}s] "${ts.token}"`,
    );
  }

  const mergedBuffer = Buffer.concat(audioBuffers);
  const floatSamples = new Float32Array(
    mergedBuffer.buffer,
    mergedBuffer.byteOffset,
    mergedBuffer.length / 4,
  );

  const audio = {
    sampleRate: SAMPLE_RATE,
    channelData: [floatSamples],
  };

  const buffer = await wavEncoder.encode(audio);
  if (!fs.existsSync(OUTPUT_DIRECTORY)) {
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_AUDIO_PATH, Buffer.from(buffer));
  fs.writeFileSync(OUTPUT_TIMESTAMP_PATH, JSON.stringify(timestamps, null, 2));

  console.log(`Audio saved to ${OUTPUT_AUDIO_PATH}`);
  console.log(`Timestamps saved to ${OUTPUT_TIMESTAMP_PATH}`);
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
    exitWithError(usage);
  }

  const text = argv._?.join(' ') || '';
  const modelId = argv.modelId || DEFAULT_TTS_MODEL_ID;
  const voiceName = argv.voiceName || DEFAULT_VOICE_ID;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    exitWithError(`You need to provide text.\n${usage}`, 1);
  }

  if (!apiKey) {
    exitWithError(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      1,
    );
  }

  return { text, modelId, voiceName, apiKey };
}
