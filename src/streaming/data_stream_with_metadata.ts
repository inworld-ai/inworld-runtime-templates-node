import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { MultimodalContentStreamIterationResult } from '@inworld/runtime/common';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

/**
 * Producer node that generates a stream of text chunks.
 */
class TextProducerNode extends CustomNode {
  private messages: string[];

  protected static getStreamType(): string {
    return 'Text';
  }

  constructor(messages: string[]) {
    super();
    this.messages = messages;
  }

  async *process(_context: ProcessContext, _input: string) {
    for (const message of this.messages) {
      yield message;
    }
  }
}

/**
 * Node that wraps a TextStream with DataStreamWithMetadata and passes it to the next node.
 */
class MetadataWrapperNode extends CustomNode {
  private metadata: Record<string, any>;

  constructor(metadata: Record<string, any> = {}) {
    super();
    this.metadata = metadata;
  }

  async process(
    _context: ProcessContext,
    textStream: GraphTypes.TextStream,
  ): Promise<GraphTypes.DataStreamWithMetadata> {
    return new GraphTypes.DataStreamWithMetadata(textStream, {
      ...this.metadata,
      elementType: 'Text',
    });
  }
}

/**
 * Node that receives DataStreamWithMetadata, reads metadata, and passes it through
 * to the next node (demonstrating passthrough of DataStreamWithMetadata).
 */
class MetadataPassthroughNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: GraphTypes.DataStreamWithMetadata,
  ): Promise<GraphTypes.DataStreamWithMetadata> {
    const metadata = input.getMetadata();

    // Add additional metadata to track passthrough
    const enrichedMetadata = {
      ...metadata,
      passedThrough: true,
      passthroughTimestamp: new Date().toISOString(),
    };

    return new GraphTypes.DataStreamWithMetadata(input, enrichedMetadata);
  }
}

/**
 * Node that receives DataStreamWithMetadata from upstream, reads metadata, and consumes the stream.
 */
class MetadataReaderNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: GraphTypes.DataStreamWithMetadata,
  ): Promise<string> {
    // Demonstrate API methods
    const metadata = input.getMetadata();
    console.log('getMetadata():', JSON.stringify(metadata));

    const elementType = input.getElementType();
    console.log(`getElementType(): "${elementType}"`);

    const typedStream = input.toStream();
    console.log(`toStream() returned: ${typedStream.constructor.name}`);

    // Consume the stream
    const results: string[] = [];
    for await (const chunk of typedStream) {
      const text = (chunk as any).text || (chunk as any).content || '';
      if (text) results.push(text);
    }

    const joined = results.join(' | ');
    return `Result: [${joined}] | Metadata: ${JSON.stringify(metadata)}`;
  }
}

/**
 * Consumer node that demonstrates DataStreamWithMetadata API.
 */
class DataStreamWithMetadataConsumerNode extends CustomNode {
  private metadata: Record<string, any>;

  constructor(metadata: Record<string, any> = {}) {
    super();
    this.metadata = metadata;
  }

  async process(
    _context: ProcessContext,
    textStream: GraphTypes.TextStream,
  ): Promise<string> {
    // Wrap the TextStream with DataStreamWithMetadata
    const wrappedStream = new GraphTypes.DataStreamWithMetadata(textStream, {
      ...this.metadata,
      elementType: 'Text',
    });

    // Demonstrate API methods
    const metadata = wrappedStream.getMetadata();
    console.log('getMetadata():', JSON.stringify(metadata));

    const elementType = wrappedStream.getElementType();
    console.log(`getElementType(): "${elementType}"`);

    const typedStream = wrappedStream.toStream();
    console.log(`toStream() returned: ${typedStream.constructor.name}`);

    // Consume the stream
    const results: string[] = [];
    for await (const chunk of typedStream) {
      const text = (chunk as any).text || (chunk as any).content || '';
      if (text) results.push(text);
    }

    const joined = results.join(' | ');
    return `Result: [${joined}] | Metadata: ${JSON.stringify(metadata)}`;
  }
}

/**
 * Audio producer node that generates audio chunks.
 */
class AudioProducerNode extends CustomNode {
  private chunkCount: number;
  private sampleRate: number;

  protected static getStreamType(): string {
    return 'Audio';
  }

  constructor(chunkCount: number, sampleRate: number = 16000) {
    super();
    this.chunkCount = chunkCount;
    this.sampleRate = sampleRate;
  }

  async *process(_context: ProcessContext, _input: string) {
    const samplesPerChunk = 1600; // 100ms at 16kHz

    for (let i = 0; i < this.chunkCount; i++) {
      const frequency = 440 + i * 110;
      const data = new Float32Array(samplesPerChunk);

      for (let j = 0; j < samplesPerChunk; j++) {
        const t = j / this.sampleRate;
        data[j] = Math.sin(2 * Math.PI * frequency * t) * 0.5;
      }

      yield new GraphTypes.Audio({
        data: data,
        sampleRate: this.sampleRate,
      });
    }
  }
}

/**
 * Audio consumer that demonstrates DataStreamWithMetadata with audio streams.
 */
class AudioDataStreamWithMetadataConsumerNode extends CustomNode {
  private metadata: Record<string, any>;

  constructor(metadata: Record<string, any> = {}) {
    super();
    this.metadata = metadata;
  }

  async process(
    _context: ProcessContext,
    audioStream: GraphTypes.AudioChunkStream,
  ): Promise<string> {
    // Wrap with DataStreamWithMetadata
    const wrappedStream = new GraphTypes.DataStreamWithMetadata(audioStream, {
      ...this.metadata,
      elementType: 'Audio',
    });

    // Demonstrate API methods
    const metadata = wrappedStream.getMetadata();
    console.log('getMetadata():', JSON.stringify(metadata));

    const elementType = wrappedStream.getElementType();
    console.log(`getElementType(): "${elementType}"`);

    const typedStream = wrappedStream.toStream();
    console.log(`toStream() returned: ${typedStream.constructor.name}`);

    // Consume the audio stream
    let chunkCount = 0;
    let totalSamples = 0;
    let sampleRate = 0;

    for await (const chunk of typedStream) {
      chunkCount++;
      const audioChunk = chunk as any;
      totalSamples += audioChunk.data?.length || 0;
      sampleRate = audioChunk.sampleRate || sampleRate;
    }

    const durationSeconds = sampleRate > 0 ? totalSamples / sampleRate : 0;
    const stats = `Audio: ${chunkCount} chunks, ${totalSamples} samples, ${durationSeconds.toFixed(2)}s`;

    return `${stats} | Metadata: ${JSON.stringify(metadata)}`;
  }
}

/**
 * Multimodal producer node that generates a stream of MultimodalContent items
 * containing both text and audio content.
 */
class MultimodalProducerNode extends CustomNode {
  private textMessages: string[];
  private audioChunks: number;
  private sampleRate: number;

  protected static getStreamType(): string {
    return 'MultimodalContent';
  }

  constructor(
    textMessages: string[],
    audioChunks: number = 2,
    sampleRate: number = 16000,
  ) {
    super();
    this.textMessages = textMessages;
    this.audioChunks = audioChunks;
    this.sampleRate = sampleRate;
  }

  async *process(_context: ProcessContext, _input: string) {
    const samplesPerChunk = 1600; // 100ms at 16kHz

    // Yield text content
    for (const message of this.textMessages) {
      yield new GraphTypes.MultimodalContent({ value: message });
    }

    // Yield audio content
    for (let i = 0; i < this.audioChunks; i++) {
      const frequency = 440 + i * 110;
      const data = new Float32Array(samplesPerChunk);

      for (let j = 0; j < samplesPerChunk; j++) {
        const t = j / this.sampleRate;
        data[j] = Math.sin(2 * Math.PI * frequency * t) * 0.5;
      }

      yield new GraphTypes.MultimodalContent({
        data: Buffer.from(data.buffer),
        sampleRate: this.sampleRate,
      });
    }
  }
}

/**
 * Multimodal consumer that demonstrates DataStreamWithMetadata with MultimodalContentStream.
 * Handles both text and audio content types.
 */
class MultimodalDataStreamWithMetadataConsumerNode extends CustomNode {
  private metadata: Record<string, any>;

  constructor(metadata: Record<string, any> = {}) {
    super();
    this.metadata = metadata;
  }

  async process(
    _context: ProcessContext,
    multimodalStream: GraphTypes.MultimodalContentStream,
  ): Promise<string> {
    // Wrap with DataStreamWithMetadata
    const wrappedStream = new GraphTypes.DataStreamWithMetadata(
      multimodalStream,
      {
        ...this.metadata,
        elementType: 'MultimodalContent',
      },
    );

    // Demonstrate API methods
    const metadata = wrappedStream.getMetadata();
    console.log('getMetadata():', JSON.stringify(metadata));

    const elementType = wrappedStream.getElementType();
    console.log(`getElementType(): "${elementType}"`);

    const typedStream = wrappedStream.toStream();
    console.log(`toStream() returned: ${typedStream.constructor.name}`);

    // Consume the multimodal stream
    let textCount = 0;
    let audioCount = 0;
    const textContents: string[] = [];

    for await (const chunk of typedStream) {
      const { value: content } =
        chunk as MultimodalContentStreamIterationResult;
      if (content.isText()) {
        textCount++;
        textContents.push(content.text || '');
      } else if (content.isAudio()) {
        audioCount++;
      }
    }

    const stats = `Multimodal: ${textCount} text items, ${audioCount} audio items`;
    const textResult =
      textContents.length > 0 ? textContents.join(' | ') : 'none';

    return `${stats} | Text: [${textResult}] | Metadata: ${JSON.stringify(metadata)}`;
  }
}

const usage = `
DataStreamWithMetadata Example

This example demonstrates how to use the DataStreamWithMetadata class to wrap
streams with arbitrary metadata. DataStreamWithMetadata is typically created
by C++ components and consumed by TypeScript nodes.

Usage:
    npm run data-stream-with-metadata -- --mode=basic "hello" "world" "inworld"
    npm run data-stream-with-metadata -- --mode=passthrough "hello" "world" "inworld"
    npm run data-stream-with-metadata -- --mode=audio --chunks 4
    npm run data-stream-with-metadata -- --mode=multimodal "hello" "world" --chunks 2

Modes:
    basic       - Text stream with metadata consumed in same node (default)
    passthrough - DataStreamWithMetadata passed between multiple nodes:
                  Producer -> Wrapper -> Passthrough -> Reader
    audio       - Audio stream with metadata
    multimodal  - MultimodalContent stream with both text and audio

Options:
    --mode      Mode to run (basic, passthrough, audio, multimodal)
    --chunks    Number of audio chunks for audio/multimodal modes (default: 4)

Key DataStreamWithMetadata APIs demonstrated:
    - getMetadata()    - Access arbitrary metadata attached to the stream
    - getElementType() - Get the stream's element type (Text, Audio, Content, etc.)
    - toStream()       - Auto-detect and return the appropriate typed stream wrapper
`;

run();

async function run() {
  const { mode, messages, chunks, apiKey } = parseArgs();

  console.log('DataStreamWithMetadata Example');
  console.log(`Mode: ${mode}`);

  try {
    if (mode === 'audio') {
      await runAudioExample(chunks, apiKey);
    } else if (mode === 'passthrough') {
      await runPassthroughExample(messages, apiKey);
    } else if (mode === 'multimodal') {
      await runMultimodalExample(messages, chunks, apiKey);
    } else {
      await runBasicExample(messages, apiKey);
    }
  } catch (error) {
    console.error('Error:', error);
  }

  stopInworldRuntime();
}

async function runBasicExample(messages: string[], apiKey: string) {
  console.log(`Input: [${messages.map((m) => `"${m}"`).join(', ')}]`);

  const metadata = {
    language: 'en',
    source: 'text-producer',
    model: 'custom-v1',
  };

  const producerNode = new TextProducerNode(messages);
  const consumerNode = new DataStreamWithMetadataConsumerNode(metadata);

  const graph = new GraphBuilder({
    id: 'data_stream_with_metadata_text_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(consumerNode)
    .addEdge(producerNode, consumerNode)
    .setStartNode(producerNode)
    .setEndNode(consumerNode)
    .build();

  const { outputStream } = await graph.start('trigger');

  console.log('Final Output:');
  for await (const result of outputStream) {
    result.processResponse({
      string: (data) => {
        console.log(data);
      },
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(data.data.text);
        }
      },
    });
  }
}

async function runPassthroughExample(messages: string[], apiKey: string) {
  console.log(`Input: [${messages.map((m) => `"${m}"`).join(', ')}]`);

  const metadata = {
    language: 'en',
    source: 'text-producer',
    model: 'custom-v1',
  };

  const producerNode = new TextProducerNode(messages);
  const wrapperNode = new MetadataWrapperNode(metadata);
  const passthroughNode = new MetadataPassthroughNode();
  const readerNode = new MetadataReaderNode();

  const graph = new GraphBuilder({
    id: 'data_stream_with_metadata_passthrough_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(wrapperNode)
    .addNode(passthroughNode)
    .addNode(readerNode)
    .addEdge(producerNode, wrapperNode)
    .addEdge(wrapperNode, passthroughNode)
    .addEdge(passthroughNode, readerNode)
    .setStartNode(producerNode)
    .setEndNode(readerNode)
    .build();

  const { outputStream } = await graph.start('trigger');

  console.log('Final Output:');
  for await (const result of outputStream) {
    result.processResponse({
      string: (data) => {
        console.log(data);
      },
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(data.data.text);
        }
      },
    });
  }
}

async function runAudioExample(chunkCount: number, apiKey: string) {
  console.log(`Generating ${chunkCount} audio chunks`);

  const metadata = {
    format: 'pcm_f32le',
    channels: 1,
    sampleRate: 16000,
    source: 'audio-generator',
  };

  const producerNode = new AudioProducerNode(chunkCount, 16000);
  const consumerNode = new AudioDataStreamWithMetadataConsumerNode(metadata);

  const graph = new GraphBuilder({
    id: 'data_stream_with_metadata_audio_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(consumerNode)
    .addEdge(producerNode, consumerNode)
    .setStartNode(producerNode)
    .setEndNode(consumerNode)
    .build();

  const { outputStream } = await graph.start('trigger');

  console.log('Final Output:');
  for await (const result of outputStream) {
    result.processResponse({
      string: (data) => {
        console.log(data);
      },
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(data.data.text);
        }
      },
    });
  }
}

async function runMultimodalExample(
  messages: string[],
  audioChunks: number,
  apiKey: string,
) {
  console.log(`Input: [${messages.map((m) => `"${m}"`).join(', ')}]`);
  console.log(`Audio chunks: ${audioChunks}`);

  const metadata = {
    contentTypes: ['text', 'audio'],
    source: 'multimodal-producer',
    model: 'custom-v1',
  };

  const producerNode = new MultimodalProducerNode(messages, audioChunks, 16000);
  const consumerNode = new MultimodalDataStreamWithMetadataConsumerNode(
    metadata,
  );

  const graph = new GraphBuilder({
    id: 'data_stream_with_metadata_multimodal_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(consumerNode)
    .addEdge(producerNode, consumerNode)
    .setStartNode(producerNode)
    .setEndNode(consumerNode)
    .build();

  const { outputStream } = await graph.start('trigger');

  console.log('Final Output:');
  for await (const result of outputStream) {
    result.processResponse({
      string: (data) => {
        console.log(data);
      },
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(data.data.text);
        }
      },
    });
  }
}

function parseArgs(): {
  mode: string;
  messages: string[];
  chunks: number;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2), {
    string: ['mode'],
    default: {
      mode: 'basic',
      chunks: 4,
    },
  });

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode || 'basic';
  const messages = (argv._ || []).map(String);
  const chunks = parseInt(argv.chunks, 10) || 4;
  const apiKey = process.env.INWORLD_API_KEY || 'dummy-key-for-offline-graph';

  if (
    (mode === 'basic' || mode === 'passthrough' || mode === 'multimodal') &&
    messages.length === 0
  ) {
    throw new Error(
      `You need to provide at least one message for ${mode} mode.\n${usage}`,
    );
  }

  return { mode, messages, chunks, apiKey };
}
