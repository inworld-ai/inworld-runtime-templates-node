import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  ProcessContext,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

interface AdvancedTextNodeConfig {
  mode: string;
  affix: {
    prefix: string;
    suffix: string;
  };
}

class AdvancedTextNode extends CustomNode<
  string,
  string,
  AdvancedTextNodeConfig
> {
  process(context: ProcessContext, input: string): string {
    const cfg = context.getExecutionConfig<AdvancedTextNodeConfig>().properties;
    console.log(cfg);
    const mode = cfg.mode || 'uppercase';
    const prefix = cfg.affix.prefix || '';
    const suffix = cfg.affix.suffix || '';

    let processedText = input;

    switch (mode) {
      case 'uppercase':
        processedText = input.toUpperCase();
        break;
      case 'lowercase':
        processedText = input.toLowerCase();
        break;
      case 'reverse':
        processedText = input.split('').reverse().join('');
        break;
      case 'titlecase':
        processedText = input.replace(
          /\w\S*/g,
          (txt: string) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
        );
        break;
      default:
        processedText = input;
    }

    return `${prefix}${processedText}${suffix}`;
  }
}

const usage = `
Usage:
    yarn node-custom-advanced "Hello, world!" \n
    --mode=<mode>[optional, default=uppercase] - Processing mode: uppercase, lowercase, reverse, titlecase \n
    --prefix=<prefix>[optional] - Text to add before the processed text \n
    --suffix=<suffix>[optional] - Text to add after the processed text \n
    --help - Show this help message`;

run();

async function run() {
  const { prompt, mode, prefix, suffix, apiKey } = parseArgs();

  const advancedTextNode = new AdvancedTextNode({
    reportToClient: true,
    executionConfig: {
      mode: mode || 'uppercase',
      affix: {
        prefix: prefix || '',
        suffix: suffix || '',
      },
    },
  });

  const graph = new GraphBuilder({
    id: 'node_custom_advanced_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(advancedTextNode)
    .setStartNode(advancedTextNode)
    .setEndNode(advancedTextNode)
    .build();

  const { outputStream } = await graph.start(prompt);

  const result = await outputStream.next();
  result.processResponse({
    string: (data) => {
      console.log(`Original text: ${prompt}`);
      console.log(`Processed text: ${data}`);
      console.log(`Mode used: ${mode || 'uppercase'}`);
    },
    default: (data) => console.log('Unprocessed data:', data),
  });
  stopInworldRuntime();
}

function parseArgs(): {
  prompt: string;
  mode?: string;
  prefix?: string;
  suffix?: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }
  const prompt = argv._?.join(' ') || '';
  const mode = argv.mode;
  const prefix = argv.prefix;
  const suffix = argv.suffix;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  return { prompt, mode, prefix, suffix, apiKey };
}
