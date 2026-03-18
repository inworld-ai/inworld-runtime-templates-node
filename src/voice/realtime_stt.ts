import 'dotenv/config';

import * as fs from 'fs';
import WebSocket from 'ws';

import {
  DEFAULT_LLM_MODEL_ID_REALTIME,
  DEFAULT_STREAMING_STT_MODEL_ID,
} from '../shared/constants';
import { exitWithError } from '../shared/helpers/cli_helpers';

const WavDecoder = require('wav-decoder');
const minimist = require('minimist');

const REALTIME_INPUT_SAMPLE_RATE = 24000;
const CHUNK_DURATION_MS = 100;
const SILENCE_PADDING_MS = 3000;

const usage = `
Usage:
    npm run node-realtime-stt -- \\
    --audioFilePath=<path-to-audio-file>[required, wav format] \\
    --llmModel=<llm-model-id>[optional, default=${DEFAULT_LLM_MODEL_ID_REALTIME}] \\
    --sttModel=<stt-model-id>[optional, default=${DEFAULT_STREAMING_STT_MODEL_ID}] \\
    --endpoint=<ws-url>[optional, overrides INWORLD_ENV-based endpoint]

Examples:
    npm run node-realtime-stt -- --audioFilePath=./audio.wav
    npm run node-realtime-stt -- --audioFilePath=./audio.wav --llmModel="openai/gpt-4o-mini"
    npm run node-realtime-stt -- --audioFilePath=./audio.wav --sttModel="inworld/inworld-stt-1"
    npm run node-realtime-stt -- --audioFilePath=./audio.wav --endpoint="wss://api.inworld.ai:443/api/v1/realtime/session?key=my-session&protocol=realtime"

Environment:
    INWORLD_API_KEY   Required. Base64 runtime API key.
    INWORLD_ENV       Optional. DEV | STAGE | PROD (default). Controls which endpoint to connect to.`;

run();

async function run() {
  const args = parseArgs();
  const url = buildEndpointUrl(args.endpoint);

  console.log('\n=== Realtime API STT ===\n');
  console.log(`Endpoint: ${url}`);
  console.log(`LLM model: ${args.llmModel}`);
  console.log(`STT model: ${args.sttModel}`);
  console.log(`Audio: ${args.audioFilePath}\n`);

  const audioData = await loadWav(args.audioFilePath);
  console.log(
    `Loaded audio: ${(audioData.samples.length / audioData.sampleRate).toFixed(2)}s @ ${audioData.sampleRate}Hz`,
  );

  const pcm16 = float32ToPcm16(audioData.samples);
  const resampled =
    audioData.sampleRate === REALTIME_INPUT_SAMPLE_RATE
      ? pcm16
      : resamplePcm16(pcm16, audioData.sampleRate, REALTIME_INPUT_SAMPLE_RATE);

  console.log(
    `Prepared ${resampled.length} PCM16 samples @ ${REALTIME_INPUT_SAMPLE_RATE}Hz\n`,
  );

  const protocols = [`basic_${args.apiKey.replace(/=/g, '')}`];
  const ws = new WebSocket(url, protocols);

  ws.on('open', () => {
    console.log('WebSocket connected.');

    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          output_modalities: ['text'],
          instructions: 'You are a helpful assistant. Respond concisely.',
          model: args.llmModel,
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: REALTIME_INPUT_SAMPLE_RATE },
              turn_detection: {
                type: 'semantic_vad',
                eagerness: 'medium',
                create_response: true,
                interrupt_response: false,
              },
              transcription: { model: args.sttModel },
            },
            output: {
              format: { type: 'audio/pcm', rate: REALTIME_INPUT_SAMPLE_RATE },
            },
          },
        },
      }),
    );

    streamAudio(ws, resampled);
  });

  ws.on('message', (data: WebSocket.RawData) => {
    const msg = JSON.parse(data.toString());
    handleServerEvent(msg, ws);
  });

  ws.on('error', (err: Error) => {
    console.error('WebSocket error:', err.message);
    process.exit(1);
  });

  ws.on('close', (code: number, reason: Buffer) => {
    console.log(
      `\nWebSocket closed (code=${code}, reason=${reason.toString()})`,
    );
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Server event handling
// ---------------------------------------------------------------------------

function handleServerEvent(msg: Record<string, any>, ws: WebSocket) {
  switch (msg.type) {
    case 'session.created':
      console.log('[session.created] Session ready.');
      break;

    case 'session.updated':
      console.log('[session.updated] Session configured.');
      break;

    case 'input_audio_buffer.speech_started':
      console.log('[speech_started] Speech detected.');
      break;

    case 'input_audio_buffer.speech_stopped':
      console.log('[speech_stopped] Speech ended.');
      break;

    case 'conversation.item.input_audio_transcription.delta':
      if (msg.delta) {
        process.stdout.write(`[transcript partial] ${msg.delta}\n`);
      }
      break;

    case 'conversation.item.input_audio_transcription.completed':
      console.log(`[transcript final] ${msg.transcript ?? ''}`);
      break;

    case 'response.text.delta':
      if (msg.delta) {
        process.stdout.write(msg.delta);
      }
      break;

    case 'response.text.done':
      process.stdout.write('\n');
      break;

    case 'response.done':
      console.log('[response.done] Response complete.');
      ws.close();
      break;

    case 'error':
      console.error('[error]', msg.error ?? msg);
      ws.close();
      break;

    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Audio streaming
// ---------------------------------------------------------------------------

async function streamAudio(ws: WebSocket, pcm16: Int16Array) {
  const samplesPerChunk = Math.floor(
    REALTIME_INPUT_SAMPLE_RATE * (CHUNK_DURATION_MS / 1000),
  );

  console.log('Streaming audio...');

  for (let i = 0; i < pcm16.length; i += samplesPerChunk) {
    const end = Math.min(i + samplesPerChunk, pcm16.length);
    const chunk = pcm16.subarray(i, end);
    const base64 = Buffer.from(
      chunk.buffer,
      chunk.byteOffset,
      chunk.byteLength,
    ).toString('base64');

    ws.send(
      JSON.stringify({ type: 'input_audio_buffer.append', audio: base64 }),
    );
    await sleep(CHUNK_DURATION_MS);
  }

  // Trailing silence so VAD can finalize the utterance
  const silenceChunkSamples = samplesPerChunk;
  const silenceChunk = new Int16Array(silenceChunkSamples);
  const silenceBase64 = Buffer.from(
    silenceChunk.buffer,
    silenceChunk.byteOffset,
    silenceChunk.byteLength,
  ).toString('base64');

  const silenceChunks = Math.ceil(SILENCE_PADDING_MS / CHUNK_DURATION_MS);
  for (let i = 0; i < silenceChunks; i++) {
    ws.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: silenceBase64,
      }),
    );
    await sleep(CHUNK_DURATION_MS);
  }

  console.log('Audio streaming complete. Waiting for response...\n');
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

async function loadWav(
  filePath: string,
): Promise<{ samples: Float32Array; sampleRate: number }> {
  if (!fs.existsSync(filePath)) {
    exitWithError(`Audio file not found: ${filePath}`, 1);
  }

  const audioData = await WavDecoder.decode(fs.readFileSync(filePath));

  if (!audioData.channelData || audioData.channelData.length === 0) {
    exitWithError('Invalid audio file: no channel data', 1);
  }

  return {
    samples: audioData.channelData[0] as Float32Array,
    sampleRate: audioData.sampleRate as number,
  };
}

function float32ToPcm16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return pcm16;
}

/** Nearest-neighbor resample -- sufficient for speech audio in a demo. */
function resamplePcm16(
  input: Int16Array,
  fromRate: number,
  toRate: number,
): Int16Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    output[i] = input[Math.min(Math.round(i * ratio), input.length - 1)];
  }
  return output;
}

// ---------------------------------------------------------------------------
// Endpoint resolution
// ---------------------------------------------------------------------------

function buildEndpointUrl(override?: string): string {
  const sessionKey = `cli-session-${Date.now()}`;

  if (override) {
    const url = new URL(override);
    if (!url.searchParams.has('key')) {
      url.searchParams.set('key', sessionKey);
    }
    if (!url.searchParams.has('protocol')) {
      url.searchParams.set('protocol', 'realtime');
    }
    return url.toString();
  }

  const env = (process.env.INWORLD_ENV || '').toUpperCase();

  switch (env) {
    case 'DEV':
      return `wss://api.dev.inworld.ai:443/api/v1/realtime/session?key=${sessionKey}&protocol=realtime`;
    case 'STAGE':
      return `wss://api.stage.inworld.ai:443/api/v1/realtime/session?key=${sessionKey}&protocol=realtime`;
    default:
      return `wss://api.inworld.ai:443/api/v1/realtime/session?key=${sessionKey}&protocol=realtime`;
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): {
  audioFilePath: string;
  llmModel: string;
  sttModel: string;
  endpoint?: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const audioFilePath = argv.audioFilePath || '';
  const llmModel = argv.llmModel || DEFAULT_LLM_MODEL_ID_REALTIME;
  const sttModel = argv.sttModel || DEFAULT_STREAMING_STT_MODEL_ID;
  const endpoint = argv.endpoint || undefined;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!audioFilePath) {
    exitWithError(`You need to provide an audioFilePath.\n${usage}`, 1);
  }

  if (!apiKey) {
    exitWithError(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      1,
    );
  }

  return { audioFilePath, llmModel, sttModel, endpoint, apiKey };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on('SIGINT', () => {
  console.log('\nStopping...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('\nStopping...');
  process.exit(0);
});
