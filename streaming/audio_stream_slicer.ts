import 'dotenv/config';

import { DataStreamWithMetadata, stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

// Helper to create tagged audio objects
const audio = (data: Float32Array, sampleRate: number) => ({
  type: 'Audio',
  data: { data: Array.from(data), sampleRate },
});

const text = (txt: string) => ({ type: 'Text', data: { text: txt } });

/**
 * Audio Stream Slicer Node - Loop Implementation with DataStreamWithMetadata
 * Reads stream 2 audio chunks at a time and returns DataStreamWithMetadata with:
 * - metadata.joined_samples: total samples in the 2 chunks combined
 * - metadata.end: true when stream is exhausted
 * - metadata.chunk_count: number of chunks read in this iteration
 * - stream: the underlying NAPI stream (for next iteration to continue reading)
 */
class AudioStreamSlicerNode extends CustomNode {
  async process(
    context: ProcessContext,
    input: GraphTypes.AudioChunkStream | DataStreamWithMetadata,
  ) {
    // Extract AudioChunkStream from either input type
    // toStream() automatically detects the type from metadata.elementType
    const audioStream =
      input instanceof DataStreamWithMetadata
        ? (input.toStream() as GraphTypes.AudioChunkStream)
        : input;

    const chunks: { data: Float32Array; sampleRate: number }[] = [];
    let isExhausted = false;
    let sampleRate = 16000; // default

    // Read up to 2 chunks from AudioChunkStream
    for (let i = 0; i < 2; i++) {
      const result = await audioStream.next();

      if (result.done) {
        console.log(`  Stream exhausted after ${chunks.length} chunk(s)`);
        isExhausted = true;
        break;
      }

      sampleRate = result.sampleRate;
      console.log(
        `  Received chunk ${i + 1}: ${result.data.length} samples @ ${sampleRate}Hz`,
      );
      chunks.push({ data: result.data, sampleRate: result.sampleRate });
    }

    // Join the chunks
    let joinedData: Float32Array;
    if (chunks.length === 0) {
      joinedData = new Float32Array(0);
    } else if (chunks.length === 1) {
      joinedData = chunks[0].data;
    } else {
      const totalLength = chunks.reduce(
        (sum, chunk) => sum + chunk.data.length,
        0,
      );
      joinedData = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        joinedData.set(chunk.data, offset);
        offset += chunk.data.length;
      }
    }

    const totalSamples = joinedData.length;
    const iteration =
      input instanceof DataStreamWithMetadata
        ? (input.getMetadata().iteration || 0) + 1
        : 1;

    console.log(
      `  → Creating Iteration: ${iteration} with ${totalSamples} joined samples`,
    );
    console.log(`  → Stream exhausted: ${isExhausted}`);

    // Return DataStreamWithMetadata - pass AudioChunkStream directly!
    return new DataStreamWithMetadata(
      audioStream, // Pass AudioChunkStream directly
      {
        elementType: 'Audio',
        joined_samples: totalSamples,
        chunk_count: chunks.length,
        sample_rate: sampleRate,
        end: isExhausted,
        iteration: iteration,
        // Store the joined audio data for the processing node
        joined_data: Array.from(joinedData),
      },
    );
  }
}

/**
 * Iteration processing node that computes statistics on joined audio chunks
 */
class IterationProcessingNode extends CustomNode {
  async process(_context: ProcessContext, input: DataStreamWithMetadata) {
    console.log('\n=== Iteration processing node ===');

    const metadata = input.getMetadata();
    const joinedData = new Float32Array(metadata.joined_data || []);

    // Compute simple statistics
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;

    for (let i = 0; i < joinedData.length; i++) {
      const sample = joinedData[i];
      sum += Math.abs(sample);
      max = Math.max(max, sample);
      min = Math.min(min, sample);
    }

    const avgAmplitude = joinedData.length > 0 ? sum / joinedData.length : 0;
    const durationMs =
      metadata.sample_rate > 0
        ? (joinedData.length / metadata.sample_rate) * 1000
        : 0;

    const stats =
      `Iteration ${metadata.iteration}: ${metadata.joined_samples} samples (${durationMs.toFixed(2)}ms), ` +
      `avg amplitude: ${avgAmplitude.toFixed(4)}, range: [${min.toFixed(4)}, ${max.toFixed(4)}]`;

    console.log(`  ${stats}`);

    return text(stats);
  }
}

const usage = `
Simple Audio Stream Slicer Example - DataStreamWithMetadata Loop Implementation

Usage:
    yarn simple-audio-stream-slicer --chunks <number> [--chunk-size-ms <ms>] [--sample-rate <hz>]
    
Example:
    yarn simple-audio-stream-slicer --chunks 6 --chunk-size-ms 100 --sample-rate 16000
    
Options:
    --chunks: Number of audio chunks to generate (required)
    --chunk-size-ms: Duration of each chunk in milliseconds (default: 100)
    --sample-rate: Sample rate in Hz (default: 16000)
    
    Iteration 1: Reads chunk 1 + chunk 2 → computes stats → loops back
    Iteration 2: Reads chunk 3 + chunk 4 → computes stats → loops back
    Iteration 3: Reads chunk 5 + chunk 6 → computes stats → completes
    
This example demonstrates:
  - Using DataStreamWithMetadata to pass NAPI audio stream + metadata in graph loops
  - metadata.joined_samples: tracks total samples read (2 chunks combined)
  - metadata.chunk_count: number of chunks read in iteration
  - metadata.end: signals when input stream is exhausted
  - metadata.iteration: tracks loop iteration count
  - metadata.elementType: 'Audio' documents the stream element type
  - stream: underlying NAPI stream (continues to be read across iterations)
  - AudioChunkStream wrapper reconstructed from NAPI stream in each iteration
  - IterationProcessingNode computes and outputs statistics on EVERY iteration
  - Loop continues until stream is exhausted (end === true)
  - Outputs statistics as results are processed (not just at the end)
  - Clean pattern for stateful audio stream processing with incremental output
`;

run();

async function run() {
  const { chunkCount, chunkSizeMs, sampleRate, apiKey } = parseArgs();

  console.log('\n=== Simple Audio Stream Slicer Example ===');
  console.log(
    `Generating ${chunkCount} chunks of ${chunkSizeMs}ms @ ${sampleRate}Hz`,
  );
  console.log(`Will join every 2 chunks and compute statistics in a loop`);

  // Create async generator that yields audio chunks
  async function* audioGenerator() {
    console.log('\n=== Producing audio chunks from input ===');

    const samplesPerChunk = Math.floor((sampleRate * chunkSizeMs) / 1000);

    for (let i = 0; i < chunkCount; i++) {
      // Generate a simple sine wave for demonstration
      const frequency = 440 + i * 110; // Varying frequency for each chunk
      const data = new Float32Array(samplesPerChunk);

      for (let j = 0; j < samplesPerChunk; j++) {
        const t = j / sampleRate;
        data[j] = Math.sin(2 * Math.PI * frequency * t) * 0.5;
      }

      console.log(
        `  Yielding chunk ${i + 1}/${chunkCount}: ${samplesPerChunk} samples @ ${frequency}Hz`,
      );
      yield audio(data, sampleRate);
    }
  }

  // Tag the generator with 'Audio' type
  const taggedStream = Object.assign(audioGenerator(), {
    type: 'Audio',
  });

  // Create the nodes
  const slicerNode = new AudioStreamSlicerNode();
  const processingNode = new IterationProcessingNode();

  // Build the graph with loop
  const graph = new GraphBuilder({
    id: 'simple_audio_stream_slicer_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(slicerNode)
    .addNode(processingNode)
    // Always go to processing node to output statistics
    .addEdge(slicerNode, processingNode)
    // Also loop back to slicer if stream is not exhausted
    .addEdge(slicerNode, slicerNode, {
      condition: async (input: any) => {
        // Edge conditions receive metadata only (no stream)
        // Loop back when stream is NOT exhausted
        const shouldLoop = input?.end !== true;
        console.log(
          `  → Loop condition: iteration=${input?.iteration}, end=${input?.end}, shouldLoop=${shouldLoop}`,
        );
        return shouldLoop;
      },
      loop: true,
    })
    .setStartNode(slicerNode)
    .setEndNode(processingNode)
    .build();

  // Execute the graph with the tagged stream as input
  const { outputStream } = await graph.start(taggedStream);

  // Display the final results
  console.log('\n=== Final Output ===');
  for await (const result of outputStream) {
    result.processResponse({
      default: (data: any) => {
        if (data?.data?.text) {
          console.log(`Result: ${data.data.text}`);
        } else {
          console.log('Result:', data);
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
