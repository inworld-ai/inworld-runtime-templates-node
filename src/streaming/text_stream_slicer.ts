import 'dotenv/config';

import { DataStreamWithMetadata, stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
  ProxyNode,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

// Helper to create tagged text objects
const text = (txt: string) => ({ _iw_type: 'Text', data: { text: txt } });

/**
 * String Stream Slicer Node - Loop Implementation with DataStreamWithMetadata
 * Reads stream 2 chunks at a time and returns DataStreamWithMetadata with:
 * - metadata.aggregated_text: the 2 chunks combined
 * - metadata.end: true when stream is exhausted
 * - stream: the underlying NAPI stream (for next iteration to continue reading)
 */
class StringStreamSlicerNode extends CustomNode {
  async process(
    context: ProcessContext,
    input0: GraphTypes.TextStream,
    input: DataStreamWithMetadata,
  ) {
    // Extract TextStream from either input type
    // toStream() automatically detects the type from stream.type property
    const textStream =
      input !== undefined &&
      input !== null &&
      input instanceof DataStreamWithMetadata
        ? (input.toStream() as GraphTypes.TextStream)
        : input0;

    const chunks: string[] = [];
    let isExhausted = false;

    // Read up to 2 chunks from TextStream
    for (let i = 0; i < 2; i++) {
      const result = await textStream.next();

      if (result.done) {
        console.log(`  Stream exhausted after ${chunks.length} chunk(s)`);
        isExhausted = true;
        break;
      }

      const txt = result.text;
      console.log(`  Received chunk ${i + 1}: "${txt}"`);
      chunks.push(txt);
    }

    // Create metadata with aggregated text and end signal
    const aggregatedText = chunks.join(' + ');
    const iteration =
      input instanceof DataStreamWithMetadata
        ? (input.getMetadata().iteration || 0) + 1
        : 1;

    console.log(
      `  → Creating Iteration: ${iteration} with aggregated text: "${aggregatedText}"`,
    );
    console.log(`  → Stream exhausted: ${isExhausted}`);

    // Return DataStreamWithMetadata - pass TextStream directly!
    // No need to manually extract/wrap NAPI streams
    return new DataStreamWithMetadata(
      textStream, // Pass TextStream directly
      {
        elementType: 'Text',
        aggregated_text: aggregatedText,
        chunks_read: chunks.length,
        end: isExhausted,
        iteration: iteration,
      },
    );
  }
}

/**
 * Iteration processing node that reverses aggregated chunks on each iteration
 */
class IterationProcessingNode extends CustomNode {
  async process(_context: ProcessContext, input: DataStreamWithMetadata) {
    console.log('\n=== Iteration processing node ===');

    const metadata = input.getMetadata();
    const reversedAggregated = metadata.aggregated_text
      ? metadata.aggregated_text.split('').reverse().join('')
      : '';

    console.log(`  Reversed result: "${reversedAggregated}"`);

    return text(reversedAggregated);
  }
}

const usage = `
Simple String Stream Slicer Example - DataStreamWithMetadata Loop Implementation

Usage:
    yarn simple-string-stream-slicer "hello" "world" "inworld" "test"
    
Example:
    yarn simple-string-stream-slicer "foo" "bar" "baz" "qux" "123" "456"
    
    Iteration 1: Reads "foo" + "bar" → outputs "rab + oof" → loops back
    Iteration 2: Reads "baz" + "qux" → outputs "xuq + zab" → loops back
    Iteration 3: Reads "123" + "456" → outputs "654 + 321" → completes
    
This example demonstrates:
  - Using DataStreamWithMetadata to pass NAPI stream + metadata in graph loops
  - metadata.aggregated_text: tracks what was read (2 chunks combined)
  - metadata.end: signals when input stream is exhausted
  - metadata.iteration: tracks loop iteration count
  - metadata.elementType: 'Text' documents the stream element type
  - stream: underlying NAPI stream (continues to be read across iterations)
  - TextStream wrapper reconstructed from NAPI stream in each iteration
  - IterationProcessingNode reverses and outputs aggregated text on EVERY iteration
  - Loop continues until stream is exhausted (end === true)
  - Outputs stream as results are processed (not just at the end)
  - Clean pattern for stateful stream processing with incremental output
`;

run();

async function run() {
  const { messages, apiKey } = parseArgs();

  console.log('\n=== Simple String Stream Slicer Example ===');
  console.log(`Input messages: [${messages.join(', ')}]`);

  // Create async generator that yields text objects
  async function* messageGenerator() {
    console.log('\n=== Producing text chunks from input ===');
    for (const message of messages) {
      console.log(`  Yielding: "${message}"`);
      yield text(message);
    }
  }

  // Tag the generator with 'Text' type
  const taggedStream = Object.assign(messageGenerator(), {
    _iw_type: 'Text',
  });

  // Create the nodes
  const audioInputNode = new ProxyNode();
  const slicerNode = new StringStreamSlicerNode();
  const processingNode = new IterationProcessingNode();

  // Build the graph with loop
  const graph = new GraphBuilder({
    id: 'simple_string_stream_slicer_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(audioInputNode)
    .addNode(slicerNode)
    .addNode(processingNode)
    // Always go to processing node to output reversed aggregated chunks
    .addEdge(audioInputNode, slicerNode)
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
      optional: true,
    })
    .setStartNode(audioInputNode)
    .setEndNode(processingNode)
    .build();

  // Execute the graph with the tagged stream as input
  const { outputStream } = await graph.start(taggedStream);

  // Display the final result
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
  messages: string[];
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const messages = (argv._ || []).map(String);
  console.log('messages', messages);
  const apiKey = process.env.INWORLD_API_KEY || 'dummy-key-for-offline-graph';

  if (messages.length === 0) {
    throw new Error(`You need to provide at least one message.\n${usage}`);
  }

  return { messages, apiKey };
}
