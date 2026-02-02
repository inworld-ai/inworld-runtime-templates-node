import * as path from 'path';

export const mockErrorStatus = 'Mock error status';

export const textConfig = {
  max_new_tokens: 10,
  max_prompt_length: 100,
  repetition_penalty: 1,
  top_p: 1,
  temperature: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
};

export const synthesisConfig = {
  config: {
    model_id: 'inworld-tts-1',
    preprocessing: {
      normalize_text: true,
    },
    postprocessing: {
      sample_rate: 16000,
      trim_silence: true,
    },
    inference: {
      alpha: 0.3,
      beta: 0.7,
      diffusion_steps: 5,
      speech_tempo: 1.0,
    },
  },
};

export const prompt = 'Hello, world!';
export const voiceName = 'Ronald';
export const filePathSTT = path.join(__dirname, 'stt', 'audio.wav');
export const fileTextSTT = 'How can I assist you today';
export const filePathVAD = path.join(__dirname, 'vad', 'audio.wav');
export const invalidApiKeyErrorMessage = 'Invalid authorization credentials';

export const remoteEmbeddingsModels = [
  { name: 'BAAI/bge-large-en-v1.5', dimension: 1024, provider: 'inworld' },
  {
    name: 'sentence-transformers/paraphrase-multilingual-mpnet-base-v2',
    provider: 'inworld',
    dimension: 768,
  },
];

export const remoteLLMModels = [
  { name: 'inworld-dragon', provider: 'inworld' },
  { name: 'inworld-mage', provider: 'inworld' },
  { name: 'meta-llama/Llama-3.1-70b-Instruct', provider: 'inworld' },
];

export const embeddingsTestData = [
  'Hello, how are you?',
  'Hi, how are you doing?',
  'The weather is nice today.',
];

export const intentTestData = [
  { intent: 'greeting', text: 'Hi, how are you?' },
  { intent: 'help', text: 'I need some assistance please' },
  { intent: 'farewell', text: 'See you tomorrow' },
  { intent: 'help', text: 'Could you help me with something?' },
  { intent: 'greeting', text: 'Good morning everyone' },
];

export const basicNerTestData = [
  {
    text: 'John Smith works at Google in San Francisco.',
    entities: [
      { entityName: 'PERSON', text: 'John Smith' },
      { entityName: 'ORGANIZATION', text: 'Google' },
      { entityName: 'LOCATION', text: 'San Francisco' },
    ],
  },
  {
    text: 'Jane Doe from Microsoft is moving to Seattle next month.',
    entities: [
      { entityName: 'PERSON', text: 'Jane Doe' },
      { entityName: 'ORGANIZATION', text: 'Microsoft' },
      { entityName: 'LOCATION', text: 'Seattle' },
    ],
  },
  {
    text: 'Alice Williams joined OpenAI in Silicon Valley.',
    entities: [
      { entityName: 'PERSON', text: 'Alice Williams' },
      { entityName: 'ORGANIZATION', text: 'OpenAI' },
      { entityName: 'LOCATION', text: 'Silicon Valley' },
    ],
  },
];

export const basicSafetyTestData = [
  {
    text: 'I love pizza',
    isSafe: true,
  },
  {
    text: 'I want to kill myself',
    isSafe: false,
    detectedCategories: ['UnconditionalSelfHarm'],
  },
  {
    text: "Let's go get drunk",
    isSafe: true,
  },
  {
    text: 'I hate that religion',
    isSafe: true,
  },
];

export const customSafetyTestCase = {
  text: 'I want to destroy the world',
  isSafe: false,
  detectedCategories: ['UnconditionalSelfHarm'],
};

export const knowledgeCompileConfig = {
  parsingConfig: {
    maxCharsPerChunk: 200,
    maxChunksPerDocument: 100,
  },
};

export const localKnowledgeConfig = {
  knowledgeCompileConfig,
  knowledgeGetConfig: {
    retrievalConfig: {
      topK: 3,
      threshold: 0.7,
    },
  },
};

export const remoteTextCompletionLLMs = [
  { name: 'meta-llama/Llama-3.1-70b-Instruct', provider: 'inworld' },
  { name: 'mistralai/Mistral-Nemo-Instruct-2407', provider: 'inworld' },
  // Note: gpt-3.5-turbo-instruct was removed as it's no longer supported by the runtime
];

export const remoteChatModels = [
  { name: 'gpt-4.1', provider: 'openai' },
  { name: 'claude-sonnet-4-0', provider: 'anthropic' },
  { name: 'gemini-2.5-flash-lite', provider: 'google' },
  { name: 'meta-llama/Llama-3.1-70b-Instruct', provider: 'inworld' },
  { name: 'mistralai/Mistral-Nemo-Instruct-2407', provider: 'inworld' },
  { name: 'tenstorrent/Llama-3.3-70B-Instruct', provider: 'tenstorrent' },
];

// Re-export fixtures from other files
export * from './llm_chat';
