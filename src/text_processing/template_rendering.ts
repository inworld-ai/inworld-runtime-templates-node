import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  GraphBuilder,
  GraphTypes,
  ProcessContext,
} from '@inworld/runtime/graph';
import { PromptBuilder } from '@inworld/runtime/primitives/llm';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import z from 'zod';

const minimist = require('minimist');

const JinjaRenderInputSchema = z.object({
  prompt: z.string(),
  promptProps: z.string(),
});

const JinjaRenderOutputSchema = z.object({
  renderedPrompt: z.string(),
});

type JinjaRenderInputInterface = z.infer<typeof JinjaRenderInputSchema>;
type JinjaRenderOutputInterface = z.infer<typeof JinjaRenderOutputSchema>;

class JinjaRenderNode extends CustomNode<
  GraphTypes.Custom<JinjaRenderInputInterface>,
  GraphTypes.Custom<JinjaRenderOutputInterface>
> {
  schema = {
    input: JinjaRenderInputSchema,
    output: JinjaRenderOutputSchema,
  };
  async process(
    context: ProcessContext,
    opts: GraphTypes.Custom<JinjaRenderInputInterface>,
  ): Promise<GraphTypes.Custom<JinjaRenderOutputInterface>> {
    const builder = await PromptBuilder.create(opts.prompt);
    const variables = JSON.parse(opts.promptProps);
    const renderedPrompt = await builder.build(variables);

    return { renderedPrompt };
  }
}

const usage = `
Usage:
    yarn node-custom-jinja \n
    --prompt=<path-to-prompt-file>[optional, a default file can be loaded instead] \n
    --promptProps=<path-to-prompt-vars-file>[optional, a default file can be loaded instead]

Description:
    This example demonstrates how to create a custom node that renders a Jinja template.
    The node is asynchronous and will return the rendered prompt.
`;

run();

async function run() {
  const args = parseArgs();

  // Validate prompt file path
  if (!existsSync(args.prompt)) {
    console.error(
      `\x1b[31mError: Prompt file not found: ${args.prompt}\x1b[0m`,
    );
    process.exit(1);
  }

  // Validate prompt props file path
  if (!existsSync(args.promptProps)) {
    console.error(
      `\x1b[31mError: Prompt props file not found: ${args.promptProps}\x1b[0m`,
    );
    process.exit(1);
  }

  const customNode = new JinjaRenderNode();
  const prompt = readFileSync(args.prompt, 'utf8');
  const promptProps = readFileSync(args.promptProps, 'utf8');

  const graph = new GraphBuilder({
    id: 'custom_jinja_graph',
    enableRemoteConfig: false,
  })
    .addNode(customNode)
    .setStartNode(customNode)
    .setEndNode(customNode)
    .build();

  const { outputStream } = await graph.start({
    prompt,
    promptProps,
  });

  const response = await outputStream.next();

  await response.processResponse({
    Custom: (data) => {
      const customData = data as { renderedPrompt: string };
      console.log(
        '\n\n\x1b[45m Rendered Jinja Template: \x1b[0m\n\n',
        customData.renderedPrompt,
      );
    },
  });
  stopInworldRuntime();
}

function parseArgs(): {
  prompt: string;
  promptProps: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  let prompt = argv.prompt;
  let promptProps = argv.promptProps;

  if (!prompt) {
    let promptPath = path.join(
      __dirname,
      '..',
      'shared',
      'prompts',
      'basic_prompt.jinja',
    );
    console.warn(
      '\x1b[33musing default prompt file (' + promptPath + ')\x1b[0m',
    );
    prompt = promptPath;
  }

  if (!promptProps) {
    let promptPropsPath = path.join(
      __dirname,
      '..',
      'shared',
      'prompts',
      'basic_prompt_props.json',
    );
    console.warn(
      '\x1b[33musing default promptProps file (' + promptPropsPath + ')\x1b[0m',
    );
    promptProps = promptPropsPath;
  }

  return { prompt, promptProps };
}
