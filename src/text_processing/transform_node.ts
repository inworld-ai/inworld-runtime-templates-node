import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import { GraphBuilder, TransformNode } from '@inworld/runtime/graph';

const minimist = require('minimist');

const usage = `
Usage:
  yarn ts-node src/text_processing/transform_node.ts \\
    --customerName="Ava" --orderId="ORDER-2198" --status="shipped"

Description:
  Demonstrates the built-in TransformNode. The graph ingests a structured
  payload (order + customer metadata) and emits a formatted text summary by
  evaluating CEL expressions inside the output template.
`;

void run();

async function run() {
  const args = parseArgs();

  const transformNode = new TransformNode({
    id: 'order_summary_transform',
    reportToClient: true,
    outputType: 'Text',
    outputTemplate: {
      value:
        "'Order ' + input.order.id + ' for ' + input.customer.name + ' is currently ' + input.order.status",
    },
  });

  const graph = new GraphBuilder({
    id: 'transform_node_graph',
    enableRemoteConfig: false,
  })
    .addNode(transformNode)
    .setStartNode(transformNode)
    .setEndNode(transformNode)
    .build();

  const payload = {
    order: {
      id: args.orderId,
      status: args.status,
      total: args.total,
    },
    customer: {
      name: args.customerName,
      tier: args.customerTier,
    },
  };

  const { outputStream } = await graph.start(payload);

  for await (const response of outputStream) {
    await response.processResponse({
      string: (text) => {
        console.log('\n=== Order Summary ===');
        console.log(text);
      },
      Custom: (data) => {
        console.log('\n=== Order Summary (Custom) ===');
        console.log(data);
      },
    });
    break;
  }

  stopInworldRuntime();
}

function parseArgs(): {
  customerName: string;
  orderId: string;
  status: string;
  total: string;
  customerTier: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  return {
    customerName: argv.customerName ?? 'Riley Meadows',
    orderId: argv.orderId ?? 'ORDER-2198',
    status: argv.status ?? 'processing',
    total: argv.total ?? '$249.99',
    customerTier: argv.customerTier ?? 'gold',
  };
}

process.on('unhandledRejection', (error) => {
  console.error('Transform node example failed:', error);
  stopInworldRuntime();
  process.exit(1);
});
