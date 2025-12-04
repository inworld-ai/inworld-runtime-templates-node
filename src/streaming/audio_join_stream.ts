import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

/**
 * Producer node that generates a stream of audio chunks
 */
class AudioProducerNode extends CustomNode {
  private chunkCount: number;
  private chunkSizeMs: number;
  private sampleRate: number;

  // Override to specify that this node outputs an Audio stream
  protected static getStreamType(): string {
    return 'Audio';
  }

  constructor(
    chunkCount: number,
    chunkSizeMs: number = 100,
    sampleRate: number = 16000,
  ) {
    super();
    this.chunkCount = chunkCount;
    this.chunkSizeMs = chunkSizeMs;
    this.sampleRate = sampleRate;
  }

  *process(_context: ProcessContext, _input: string) {
    console.log('\n=== Producing audio chunks ===');

    const samplesPerChunk = Math.floor(
      (this.sampleRate * this.chunkSizeMs) / 1000,
    );

    for (let i = 0; i < this.chunkCount; i++) {
      // Generate a simple sine wave for demonstration
      const frequency = 440 + i * 110; // Varying frequency for each chunk
      const data = new Float32Array(samplesPerChunk);

      for (let j = 0; j < samplesPerChunk; j++) {
        const t = j / this.sampleRate;
        data[j] = Math.sin(2 * Math.PI * frequency * t) * 0.5;
      }

      console.log(
        `  Yielding chunk ${i + 1}/${this.chunkCount}: ${samplesPerChunk} samples @ ${frequency}Hz`,
      );
      yield new GraphTypes.Audio({
        data: Array.from(data),
        sampleRate: this.sampleRate,
      });
    }
  }
}

/**
 * Consumer node that reads an AudioChunkStream, joins every 2 chunks, and outputs results
 */
class AudioJoinNode extends CustomNode {
  // Override to specify that this node outputs an Audio stream
  protected static getStreamType(): string {
    return 'Audio';
  }

  async *process(
    _context: ProcessContext,
    audioStream: GraphTypes.AudioChunkStream,
  ): AsyncGenerator<GraphTypes.Audio> {
    console.log('\n=== Joining audio chunks (2 by 2) ===');

    let buffer: { data: Float32Array; sampleRate: number } | null = null;
    let chunkIndex = 0;

    // Consume the AudioChunkStream - it yields AudioChunkStreamIterationResult objects
    for await (const chunk of audioStream) {
      chunkIndex++;

      console.log(
        `  Received chunk ${chunkIndex}: ${chunk.data.length} samples @ ${chunk.sampleRate}Hz`,
      );

      if (!buffer) {
        // Store first chunk
        buffer = { data: chunk.data, sampleRate: chunk.sampleRate };
      } else {
        // Join with stored chunk
        const joinedData = new Float32Array(
          buffer.data.length + chunk.data.length,
        );
        joinedData.set(buffer.data, 0);
        joinedData.set(chunk.data, buffer.data.length);

        console.log(
          `  → Joined chunks: ${buffer.data.length} + ${chunk.data.length} = ${joinedData.length} samples`,
        );

        yield new GraphTypes.Audio({
          data: Array.from(joinedData),
          sampleRate: buffer.sampleRate,
        });
        buffer = null;
      }
    }

    // If there's a remaining chunk, output it
    if (buffer) {
      console.log(`  → Output remaining chunk: ${buffer.data.length} samples`);
      yield new GraphTypes.Audio({
        data: Array.from(buffer.data),
        sampleRate: buffer.sampleRate,
      });
    }
  }
}

/**
 * Statistics node that consumes an AudioChunkStream and outputs text with statistics
 */
class StatisticsNode extends CustomNode {
  async process(
    _context: ProcessContext,
    audioStream: GraphTypes.AudioChunkStream,
  ): Promise<string> {
    console.log('\n=== Collecting statistics ===');

    let chunkCount = 0;
    let totalSamples = 0;
    let sampleRate = 0;

    // Consume the AudioChunkStream
    for await (const chunk of audioStream) {
      chunkCount++;
      totalSamples += chunk.data.length;
      sampleRate = chunk.sampleRate; // Use the sample rate from chunks
      console.log(`  Chunk ${chunkCount}: ${chunk.data.length} samples`);
    }

    const durationSeconds = sampleRate > 0 ? totalSamples / sampleRate : 0;
    const stats = `Statistics: ${chunkCount} chunks, ${totalSamples} total samples, ${durationSeconds.toFixed(2)}s duration @ ${sampleRate}Hz`;

    console.log(`  ${stats}`);
    return stats;
  }
}

const usage = `
Simple Audio Join Stream Example

Usage:
    yarn simple-audio-join-stream --chunks <number> [--chunk-size-ms <ms>] [--sample-rate <hz>]
    
Example:
    yarn simple-audio-join-stream --chunks 5 --chunk-size-ms 100 --sample-rate 16000
    
Options:
    --chunks: Number of audio chunks to generate (required)
    --chunk-size-ms: Duration of each chunk in milliseconds (default: 100)
    --sample-rate: Sample rate in Hz (default: 16000)

This example demonstrates:
  - AudioProducerNode produces a stream of audio chunks
  - AudioJoinNode joins every 2 audio chunks into one by concatenating Float32Arrays
  - StatisticsNode consumes the audio stream and outputs text statistics
  - No external APIs required - pure custom nodes!
`;

run();

async function run() {
  const { chunkCount, chunkSizeMs, sampleRate, apiKey } = parseArgs();

  console.log('\n=== Simple Audio Join Stream Example ===');
  console.log(
    `Generating ${chunkCount} chunks of ${chunkSizeMs}ms @ ${sampleRate}Hz`,
  );
  console.log(`Will join every 2 chunks together`);

  // Create the nodes
  const producerNode = new AudioProducerNode(
    chunkCount,
    chunkSizeMs,
    sampleRate,
  );
  const joinNode = new AudioJoinNode();
  const statsNode = new StatisticsNode();

  // Build the graph: Producer → Join → Statistics
  const graph = new GraphBuilder({
    id: 'simple_audio_join_stream_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(joinNode)
    .addNode(statsNode)
    .addEdge(producerNode, joinNode)
    .addEdge(joinNode, statsNode)
    .setStartNode(producerNode)
    .setEndNode(statsNode)
    .build();

  // Execute the graph
  const { outputStream } = await graph.start('trigger');

  // Display the final results
  console.log('\n=== Final Output ===');
  for await (const result of outputStream) {
    result.processResponse({
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(`Statistics: ${data.data.text}`);
        } else {
          console.log('Unprocessed data:', data);
        }
      },
    });
  }

  console.log('====================\n');
  stopInworldRuntime();
}

function parseArgs(): {
  chunkCount: number;
  chunkSizeMs: number;
  sampleRate: number;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const chunkCount = argv.chunks || argv.c;
  const chunkSizeMs = argv['chunk-size-ms'] || 100;
  const sampleRate = argv['sample-rate'] || 16000;
  const apiKey = process.env.INWORLD_API_KEY || 'dummy-key-for-offline-graph';

  if (!chunkCount) {
    throw new Error(`You need to provide --chunks argument.\n${usage}`);
  }

  return { chunkCount, chunkSizeMs, sampleRate, apiKey };
}
