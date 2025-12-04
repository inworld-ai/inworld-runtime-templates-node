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
 * Producer node that generates a stream of text chunks
 */
class TextProducerNode extends CustomNode {
  private messages: string[];

  // Override to specify that this node outputs a Text stream
  protected static getStreamType(): string {
    return 'Text';
  }

  constructor(messages: string[]) {
    super();
    this.messages = messages;
  }

  *process(_context: ProcessContext, _input: string) {
    console.log('\n=== Producing text chunks ===');
    for (const message of this.messages) {
      console.log(`  Yielding: "${message}"`);
      yield message;
    }
  }
}

/**
 * Transformer node that reads a TextStream, reverses each chunk, and yields reversed strings
 */
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
      console.log(`  "${txt}" → "${reversed}"`);
      yield reversed;
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
  ): Promise<string> {
    console.log('\n=== Joining stream chunks ===');
    const results: string[] = [];

    // Consume the TextStream - it yields TextStreamIterationResult objects
    for await (const chunk of textStream) {
      const txt = chunk.text;
      console.log(`  Collecting: "${txt}"`);
      results.push(txt);
    }

    const joined = results.join(' | ');
    console.log(`  Final joined text: "${joined}"`);
    return joined;
  }
}

const usage = `
Simple Reverse Stream Example

Usage:
    yarn simple-reverse-stream "hello" "world" "inworld"
    yarn simple-reverse-stream --no-join "hello" "world" "inworld"
    
Example:
    yarn simple-reverse-stream "foo" "bar" "baz"
    Output: "oof | rab | zab"

    yarn simple-reverse-stream --no-join "foo" "bar" "baz"
    Output (stream): "oof", "rab", "zab"

Options:
    --no-join    Skip the join node and output reversed stream directly

This example demonstrates:
  - TextProducerNode produces a stream of text chunks
  - ReverseNode transforms the stream by yielding reversed strings
  - JoinNode consumes the stream and joins into final result (optional)
  - No external APIs required - pure custom nodes!
`;

run();

async function run() {
  const { messages, apiKey, useJoin } = parseArgs();

  console.log('\n=== Simple Reverse Stream Example ===');
  console.log(`Input messages: [${messages.join(', ')}]`);
  console.log(`Using join node: ${useJoin}`);

  // Create the nodes
  const producerNode = new TextProducerNode(messages);
  const reverseNode = new ReverseNode();

  // Build the graph based on useJoin flag
  let builder = new GraphBuilder({
    id: 'simple_reverse_stream_graph',
    apiKey,
    enableRemoteConfig: false,
  })
    .addNode(producerNode)
    .addNode(reverseNode)
    .addEdge(producerNode, reverseNode)
    .setStartNode(producerNode);

  if (useJoin) {
    // Build the graph: Producer → Reverse → Join
    const joinNode = new JoinNode();
    builder = builder
      .addNode(joinNode)
      .addEdge(reverseNode, joinNode)
      .setEndNode(joinNode);
  } else {
    // Build the graph: Producer → Reverse (output stream directly)
    builder = builder.setEndNode(reverseNode);
  }

  const graph = builder.build();

  // Execute the graph
  const { outputStream } = await graph.start('trigger');

  // Display the final result
  console.log('\n=== Final Output ===');
  if (useJoin) {
    // Single result with joined text
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
  } else {
    // Stream of reversed text chunks
    for await (const result of outputStream) {
      result.processResponse({
        default: (data: any) => {
          if (data?.data?.text) {
            console.log(`Stream chunk: "${data.data.text}"`);
          } else {
            console.log('Unprocessed data:', data);
          }
        },
      });
    }
  }

  console.log('====================\n');
  stopInworldRuntime();
}

function parseArgs(): {
  messages: string[];
  apiKey: string;
  useJoin: boolean;
} {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['no-join', 'help'],
    default: {
      'no-join': false,
    },
  });

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const messages = (argv._ || []).map(String); // Convert all args to strings
  const apiKey = process.env.INWORLD_API_KEY || 'dummy-key-for-offline-graph';
  const useJoin = !argv['no-join']; // Invert the flag - no-join means useJoin = false

  if (messages.length === 0) {
    throw new Error(`You need to provide at least one message.\n${usage}`);
  }

  return { messages, apiKey, useJoin };
}
