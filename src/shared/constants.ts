import type { Camelize, TextGenerationConfig } from '@inworld/runtime/graph';
import * as path from 'path';

export enum Modes {
  LOCAL = 'local',
  REMOTE = 'remote',
}

export enum TTS_MODEL {
  INWORLD_TTS_1_5_MINI = 'inworld-tts-1.5-mini', // 1B
  INWORLD_TTS_1_5_MAX = 'inworld-tts-1.5-max', // 8B
}

export const DEFAULT_TTS_MODEL_ID = TTS_MODEL.INWORLD_TTS_1_5_MAX;
export const DEFAULT_VOICE_ID = 'Ashley';
export const DEFAULT_LLM_MODEL_NAME = 'gpt-4o-mini';
export const DEFAULT_LOCAL_LLM_MODEL_PATH = './data/models/llm/llama3_1b';
export const DEFAULT_EMBEDDER_MODEL_NAME = 'BAAI/bge-large-en-v1.5';
export const DEFAULT_EMBEDDER_PROVIDER = 'inworld';
export const DEFAULT_LLM_PROVIDER = 'openai';
export const DEFAULT_STREAMING_STT_MODEL_ID =
  'assemblyai/universal-streaming-multilingual';
export const DEFAULT_LLM_MODEL_ID_REALTIME = 'openai/gpt-4o-mini';
export const SAMPLE_RATE = 48000;
export const DEFAULT_VAD_MODEL_PATH = path.join(
  __dirname,
  'models',
  'silero_vad.onnx',
);
export const DEFAULT_LOCAL_STREAMING_VAD_MODEL_PATH = DEFAULT_VAD_MODEL_PATH;
export const TEXT_CONFIG = {
  max_new_tokens: 2500,
  max_prompt_length: 100,
  repetition_penalty: 1,
  top_p: 1,
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  stop_sequences: [] as string[],
  logit_bias: [] as Array<{ tokenId: string; biasValue: number }>,
};

export function convertTextConfigToInterface(
  config: typeof TEXT_CONFIG,
): Camelize<TextGenerationConfig> {
  return {
    maxNewTokens: config.max_new_tokens,
    maxPromptLength: config.max_prompt_length,
    repetitionPenalty: config.repetition_penalty,
    topP: config.top_p,
    temperature: config.temperature,
    frequencyPenalty: config.frequency_penalty,
    presencePenalty: config.presence_penalty,
    stopSequences: config.stop_sequences,
    logitBias: config.logit_bias,
  };
}

export const TEXT_CONFIG_SDK: Camelize<TextGenerationConfig> =
  convertTextConfigToInterface(TEXT_CONFIG);

export const SYNTHESIS_CONFIG = {
  type: 'inworld',
  config: {
    model_id: DEFAULT_TTS_MODEL_ID,
    timestampType: 'WORD',
    postprocessing: {
      sample_rate: SAMPLE_RATE,
    },
    inference: {
      /** Best 1.0. Optimal parameters are within 0.8-1.0 */
      temperature: 1.0,
      pitch: 0.0,
      speaking_rate: 1.0,
    },
  },
};

export const INTENTS = [
  {
    name: 'greeting',
    phrases: [
      'Hello',
      'Hi there',
      'Hey',
      'Good morning',
      'Good afternoon',
      'Good evening',
    ],
  },
  {
    name: 'farewell',
    phrases: [
      'Goodbye',
      'Bye',
      'See you later',
      'Take care',
      'Have a good day',
    ],
  },
  {
    name: 'help',
    phrases: [
      'I need help',
      'Can you help me?',
      'Could you assist me?',
      'Help please',
      'Support needed',
    ],
  },
];

export const DEFAULT_TOP_K = 2;
export const DEFAULT_THRESHOLD = 0.5;

type ToolJsonSchema = {
  type: 'object';
  properties: Record<
    string,
    {
      type: string;
      description: string;
    }
  >;
  required: string[];
};

const serializeTool = (
  name: string,
  description: string,
  schema: ToolJsonSchema,
) => ({
  name,
  description,
  // LlmChatRequestToolSchema expects properties as a JSON string, not an object.
  properties: JSON.stringify(schema),
});

export const TOOLS = [
  serializeTool('calculator', 'Evaluate a mathematical expression', {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The mathematical expression to evaluate',
      },
    },
    required: ['expression'],
  }),
  serializeTool('get_weather', 'Get the current weather in a location', {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state, e.g., San Francisco, CA',
      },
    },
    required: ['location'],
  }),
] as any;
