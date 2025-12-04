import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

// Helper to create tagged text objects
const text = (txt: string) => ({ _iw_type: 'Text', data: { text: txt } });

class ReverseNode extends CustomNode {
  // Override to specify that this node outputs a Text stream
  protected static getStreamType(): string {
    return 'Text';
  }

  async *process(_context: ProcessContext, textStream: GraphTypes.TextStream) {
    console.log('\n=== Reversing stream chunks ===');

    // Consume the TextStream - it yields TextStreamIterationResult objects
    for await (const chunk of textStream) {
      const txt = chunk.text;
      const reversed = txt.split('').reverse().join('');
      yield text(reversed);
    }
  }
}

/**
 * Join node that consumes a TextStream and joins all chunks into a single Text output
 */
class JoinNode extends CustomNode {
  async process(
    _context: ProcessContext,
    textStream: GraphTypes.TextStream,
  ): Promise<{ _iw_type: string; data: { text: string } }> {
    console.log('\n=== Joining stream chunks ===');
    const results: string[] = [];

    // Consume the TextStream - it yields TextStreamIterationResult objects
    for await (const chunk of textStream) {
      const txt = chunk.text;
      results.push(txt);
    }

    const joined = results.join(' | ');
    console.log(`  Final joined text: "${joined}"`);
    return text(joined);
  }
}

const usage = `
Simple Reverse Stream Input Example

Usage:
    yarn simple-reverse-stream-input "hello" "world" "inworld" 
    
Example:
    yarn simple-reverse-stream-input "foo" "bar" "baz"
    Output: "oof | rab | zab"

This example demonstrates:
  - Passing a generator of strings directly to graph.start()
  - Tagging the generator with 'Text' type
  - ReverseNode yields reversed strings as a stream
  - JoinNode consumes the stream and joins into final result
  - No producer node needed - input comes from outside!
`;

run();

async function run() {
  const { messages, apiKey } = parseArgs();

  console.log('\n=== Simple Reverse Stream Input Example ===');
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
  // This tells toExternal() to create a DataStream<Text> which gets wrapped as TextStream
  const taggedStream = Object.assign(messageGenerator(), {
    _iw_type: 'Text',
  });

  // const input = {
  //   type: 'DataStream',
  //   data: {},
  //   _iw_stream: taggedStream,
  // }

  // Create the nodes
  const reverseNode = new ReverseNode();
  const joinNode = new JoinNode();

  // Build the graph: Input (DataStream) → Reverse → Join
  const graph = new GraphBuilder({
    id: 'simple_reverse_stream_input_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(reverseNode)
    .addNode(joinNode)
    .addEdge(reverseNode, joinNode)
    .setStartNode(reverseNode) // This node receives the input stream
    .setEndNode(joinNode)
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
          console.log('Unprocessed data:', data);
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

  const messages = (argv._ || []).map(String); // Convert all args to strings
  const apiKey = process.env.INWORLD_API_KEY || 'dummy-key-for-offline-graph';

  if (messages.length === 0) {
    throw new Error(`You need to provide at least one message.\n${usage}`);
  }

  return { messages, apiKey };
}
