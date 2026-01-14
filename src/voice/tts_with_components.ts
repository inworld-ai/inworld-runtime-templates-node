import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  RemoteLLMChatNode,
  RemoteTTSNode,
  TextChunkingNode,
} from '@inworld/runtime/graph';
import * as fs from 'fs';
import * as path from 'path';

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');

import { ResponseFormatName } from '@inworld/runtime/common';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VOICE_ID,
  SAMPLE_RATE,
} from '../shared/constants';

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  '..',
  'data-output',
  'tts_samples',
);
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'node_custom_tts_output.wav');

interface GraphInput {
  text: string;
  voiceName: string;
}

interface GraphOutput {
  llmResult: string;
  audioPath: string;
}

class NodePromptBuilder extends CustomNode {
  process(
    _context: ProcessContext,
    input: GraphInput,
  ): GraphTypes.LLMChatRequest {
    return new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'user',
          content: input.text,
        },
      ],
    });
  }
}

class NodeCustomStreamReader extends CustomNode {
  async process(
    _context: ProcessContext,
    input: GraphTypes.TTSOutputStream,
  ): Promise<GraphTypes.Custom<GraphOutput>> {
    let llmResult = '';
    const audioBuffers: Buffer[] = [];

    for await (const chunk of input) {
      if (chunk.text) llmResult += chunk.text;
      if (chunk.audio?.data) {
        const buffer = Buffer.from(chunk.audio?.data, 'base64');
        audioBuffers.push(buffer);
      }
    }
    const mergedBuffer = Buffer.concat(audioBuffers);
    const floatSamples = new Float32Array(
      mergedBuffer.buffer,
      mergedBuffer.byteOffset,
      mergedBuffer.length / 4,
    );
    // Create a single audio object with all the data
    const audio = {
      sampleRate: SAMPLE_RATE,
      channelData: [floatSamples],
    };

    // Encode and write all the audio data to a single file
    const buffer = await wavEncoder.encode(audio);
    if (!fs.existsSync(OUTPUT_DIRECTORY)) {
      fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, Buffer.from(buffer));

    return { llmResult, audioPath: OUTPUT_PATH };
  }
}

const usage = `
Usage:
    yarn node-custom-tts "Hello, how are you?" \n
    --voiceName=<voice-id>[REQUIRED, dynamic override voice for custom node, e.g. "Erik"] \n
    --modelId=<model-id>[optional, ${DEFAULT_TTS_MODEL_ID} will be used by default] \n
    --defaultVoice=<voice-id>[optional, ${DEFAULT_VOICE_ID} will be used as default voice for TTS primitive]`;

run();

async function run() {
  const { text, modelId, defaultVoice, voiceName, apiKey } = parseArgs();

  const nodePromptBuilder = new NodePromptBuilder();
  const llmNode = new RemoteLLMChatNode({
    provider: DEFAULT_LLM_PROVIDER,
    modelName: DEFAULT_LLM_MODEL_NAME,
    stream: true,
    responseFormat: ResponseFormatName.Text,
  });
  const textChunkingNode = new TextChunkingNode();
  const ttsNode = new RemoteTTSNode({
    speakerId: defaultVoice,
    modelId,
  });
  const customStreamReader = new NodeCustomStreamReader();

  const graph = new GraphBuilder({
    id: 'custom_tts_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(nodePromptBuilder)
    .addNode(llmNode)
    .addNode(textChunkingNode)
    .addNode(ttsNode)
    .addNode(customStreamReader)
    .addEdge(nodePromptBuilder, llmNode)
    .addEdge(llmNode, textChunkingNode)
    .addEdge(textChunkingNode, ttsNode)
    .addEdge(ttsNode, customStreamReader)
    .setStartNode(nodePromptBuilder)
    .setEndNode(customStreamReader)
    .build();

  const { outputStream } = await graph.start({ text, voiceName });

  let done = false;
  while (!done) {
    const result = await outputStream.next();

    await result.processResponse({
      ContentStream: async (contentStream) => {
        let llmResult = '';
        for await (const chunk of contentStream) {
          if (chunk.text) llmResult += chunk.text;
        }
        console.log('LLM report to client result:', llmResult);
      },
      Custom: (custom) => {
        console.log('Custom stream reader result:', custom);
      },
    });

    done = result.done;
  }
  stopInworldRuntime();
}

function parseArgs(): {
  text: string;
  modelId: string;
  defaultVoice: string;
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
  const defaultVoice = argv.defaultVoice || DEFAULT_VOICE_ID;
  const voiceName = argv.voiceName;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text.\n${usage}`);
  }

  if (!voiceName) {
    throw new Error(`You need to provide --voiceName parameter.\n${usage}`);
  }

  console.log(`Using default voice: ${defaultVoice} for TTS primitive`);
  console.log(`Using override voice: ${voiceName} for custom node`);

  return { text, modelId, defaultVoice, voiceName, apiKey };
}
