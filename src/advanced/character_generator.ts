import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  CustomNode,
  Graph,
  GraphBuilder,
  GraphTypes,
  InworldError,
  ProcessContext,
  RemoteLLMChatNode,
  RemoteLLMComponent,
  RemoteTTSComponent,
  RemoteTTSNode,
  TextAggregatorNode,
  TextChunkingNode,
  UserContextInterface,
} from '@inworld/runtime/graph';
import { logger } from '@inworld/runtime/telemetry';
import * as telemetry from '@inworld/runtime/telemetry';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { v7 } from 'uuid';

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VOICE_ID,
  SAMPLE_RATE,
  TEXT_CONFIG_SDK,
} from '../shared/constants';

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  '..',
  'data-output',
  'character_generator_dsl_samples',
);

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');
const { spawn } = require('child_process');

// Console colors
const GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const BLUE = '\x1b[94m';
const RESET = '\x1b[0m';

// Data structures for node communication
interface Character {
  name: string;
  setting: string;
  asset: string;
  quest: string;
  history: string[];
}

interface GameState {
  characters: { [key: string]: Character };
  currentCharacter: Character | null;
  quests: string[];
}

interface TextInput {
  text: string;
}

interface InstructInput {
  type: 'instruct';
  text: string;
}

interface SelectCharacter {
  type: 'select';
  name: string;
}

interface ChatInput {
  type: 'chat';
  name: string;
  text: string;
}

interface ComposedCharacterInfo {
  instruct: InstructInput;
  quests: string[];
  assets: string[];
}

interface CharacterResponse {
  name: string;
  text: string;
}

// Global game state
let gameState: GameState = {
  characters: {},
  currentCharacter: null,
  quests: [
    'Find the lost treasure in the ancient ruins',
    'Defeat the dragon terrorizing the village',
    'Collect rare herbs for the village healer',
    'Escort the merchant caravan safely',
    'Investigate mysterious disappearances',
    'Defend the castle from invaders',
    'Solve the riddle of the ancient temple',
    'Rescue the kidnapped princess',
    'Discover the source of the plague',
    'Unite the warring factions',
  ],
};

class InputRouterNode extends CustomNode {
  process(
    context: ProcessContext,
    textInput: TextInput,
  ): InstructInput | SelectCharacter | ChatInput {
    logger.info(
      'InputRouterNode',
      {
        text: textInput.text,
      },
      // context, temporary disabled until it is supported by addon
    );
    const text = textInput.text.trim();

    if (text.startsWith('create:')) {
      return { type: 'instruct', text: text.substring(7) } as InstructInput;
    } else if (text.startsWith('select:')) {
      return { type: 'select', name: text.substring(7) } as SelectCharacter;
    } else if (text === 'quit') {
      process.exit(0);
    }

    const currentCharacter = gameState.currentCharacter;
    if (!currentCharacter) {
      logger.error(
        'No character selected.',
        {},
        // context, temporary disabled until it is supported by addon
      );
      console.log(
        `${RED}No character selected. Use 'select:<character-name>' first${RESET}`,
      );
      return { type: 'chat', name: '', text: text } as ChatInput;
    }
    return {
      type: 'chat',
      name: currentCharacter.name,
      text: text,
    } as ChatInput;
  }
}

class CharacterAssetsFetcherNode extends CustomNode {
  process(
    context: ProcessContext,
    instructInput: InstructInput,
  ): GraphTypes.LLMChatRequest {
    logger.info(
      'CharacterAssetsFetcherNode',
      { text: instructInput.text },
      // context, temporary disabled until it is supported by addon
    );
    const templateContent = `Please generate 3 items for the game character to wear in the game world with the theme described as: ${instructInput.text}\n  Output only name of the items. Each item should be on the new line.`;

    return new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'user',
          content: templateContent,
        },
      ],
    });
  }
}

class CharacterQuestFetcherNode extends CustomNode {
  process(
    context: ProcessContext,
    instructInput: InstructInput,
  ): GraphTypes.LLMChatRequest {
    logger.info(
      'CharacterQuestFetcherNode',
      {
        text: instructInput.text,
        questCount: gameState.quests.length.toString(),
      },
      // context, temporary disabled until it is supported by addon
    );
    const questsList = gameState.quests
      .map((quest, index) => `${index}: ${quest}`)
      .join('\n');

    const templateContent = `You need to filter out quests from the list of quests and choose all quests which are appropriate to the following game setting: ${instructInput.text}

  Here is the list of quests:
  ${questsList}

  Output only quest numbers, each on new line`;

    return new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'user',
          content: templateContent,
        },
      ],
    });
  }
}

class StateCollectorNode extends CustomNode {
  process(
    context: ProcessContext,
    instructInput: InstructInput,
    assetsText: GraphTypes.Content,
    questsText: GraphTypes.Content,
  ) {
    logger.info(
      'StateCollectorNode',
      { instruction: instructInput.text },
      // context, temporary disabled until it is supported by addon
    );
    const result: ComposedCharacterInfo = {
      instruct: instructInput,
      assets: assetsText.content
        .split('\n')
        .filter((asset: string) => asset.trim().length > 0),
      quests: questsText.content
        .split('\n')
        .filter((quest: string) => quest.trim().length > 0),
    };
    return result;
  }
}

class CharacterComposerNode extends CustomNode {
  process(context: ProcessContext, finalState: ComposedCharacterInfo) {
    logger.info(
      'CharacterComposerNode',
      { instruction: finalState.instruct.text },
      // context, temporary disabled until it is supported by addon
    );
    const instructInput = finalState.instruct;
    const assetsTexts = finalState.assets;
    const questsTexts = finalState.quests.map((q) => q.toString());

    const questsList = questsTexts
      .filter((q) => q.trim().length > 0)
      .map((q) => parseInt(q.trim()))
      .filter((q) => !isNaN(q) && q >= 0 && q < gameState.quests.length)
      .map((i) => i.toString());

    const questIndex =
      questsList.length > 0
        ? parseInt(questsList[Math.floor(Math.random() * questsList.length)])
        : 0;

    const charId = Object.keys(gameState.characters).length + 1;

    const character: Character = {
      name: `Character-${charId}`,
      setting: instructInput.text,
      asset:
        assetsTexts[Math.floor(Math.random() * assetsTexts.length)] ||
        'Basic outfit',
      quest: gameState.quests[questIndex] || 'No quest available',
      history: [],
    };

    return character;
  }
}

class CharacterDeployerNode extends CustomNode {
  process(context: ProcessContext, character: Character): string {
    logger.info(
      'CharacterDeployerNode',
      { name: character.name },
      // context, temporary disabled until it is supported by addon
    );
    gameState.characters[character.name] = character;
    return JSON.stringify({ deployed: character.name });
  }
}

class CharacterSelectorNode extends CustomNode {
  process(
    context: ProcessContext,
    selectCharacter: SelectCharacter,
  ): CharacterResponse {
    logger.info(
      'CharacterSelectorNode',
      { name: selectCharacter.name },
      // context, temporary disabled until it is supported by addon
    );
    let character = gameState.characters[selectCharacter.name];

    if (!character) {
      const justNumberMatch = selectCharacter.name.match(/^\d+$/);
      if (justNumberMatch) {
        const characterName = `Character-${selectCharacter.name}`;
        character = gameState.characters[characterName];
      }
    }

    if (!character) {
      return {
        name: '',
        text: `Character not found. Available characters: ${Object.keys(
          gameState.characters,
        ).join(', ')}`,
      } as CharacterResponse;
    }

    gameState.currentCharacter = character;

    const greetingText = `Hello, I'm ${character.name}. I'm ready to talk about my quest.`;
    return {
      name: character.name,
      text: greetingText,
    } as CharacterResponse;
  }
}

class CharacterResponseGeneratorNode extends CustomNode {
  process(context: ProcessContext, chatInput: ChatInput) {
    logger.info(
      'CharacterResponseGeneratorNode',
      { name: chatInput.name, text: chatInput.text },
      // context, temporary disabled until it is supported by addon
    );
    if (!chatInput.name || chatInput.name === '') {
      console.log(`${RED}No character selected for chat${RESET}`);
      return new GraphTypes.LLMChatRequest({ messages: [] });
    }

    const character = gameState.characters[chatInput.name];
    if (!character) {
      console.log(`${RED}Character '${chatInput.name}' not found${RESET}`);
      return new GraphTypes.LLMChatRequest({ messages: [] });
    }

    const chatPrompt = `You are a game character NPC in the game world with theme setting described as: ${
      character.setting
    }
  You have the following quest to give to the user: ${character.quest}
  Your goal is to explain the quest to the user and ask for confirmation.
  Here is a history of the conversation you had with this user so far: ${character.history.join(
    ' | ',
  )}

  Respond in a concise manner to the following user message: ${chatInput.text}`;

    return new GraphTypes.LLMChatRequest({
      messages: [{ role: 'user', content: chatPrompt }],
    });
  }
}

class HistoryLoggerNode extends CustomNode {
  process(
    context: ProcessContext,
    content: string,
    chatInput: ChatInput,
  ): CharacterResponse {
    logger.info(
      'HistoryLoggerNode',
      {
        character: chatInput.name,
        contentLength: content.length.toString(),
      },
      // context, temporary disabled until it is supported by addon
    );
    const llmResponseText = content;

    if (llmResponseText.startsWith('SYSTEM_ERROR:')) {
      const errorText = llmResponseText.substring(13);
      const errorResponse = { name: chatInput.name, text: errorText };
      console.log(`${RED}Error: ${errorText}${RESET}`);
      return errorResponse as CharacterResponse;
    }

    const characterResponse = { name: chatInput.name, text: llmResponseText };
    const character = gameState.characters[chatInput.name];
    if (character) {
      character.history.push(`user: ${chatInput.text}`);
      character.history.push(`character: ${characterResponse.text}`);
    } else {
      console.log(`${RED}Character not found for logging history.${RESET}`);
    }

    return characterResponse as CharacterResponse;
  }
}

class TTSTextExtractorNode extends CustomNode {
  process(context: ProcessContext, inputText: CharacterResponse): string {
    logger.info(
      'TTSTextExtractorNode',
      {
        character: inputText.name,
        textLength: (inputText.text?.length || 0).toString(),
      },
      // context, temporary disabled until it is supported by addon
    );
    try {
      const actualText = inputText.text;
      return actualText || '';
    } catch (error) {
      console.error(`${RED}Error parsing input:${RESET}`, error);
      const fallbackText = (inputText as any).text || '';
      console.log(`${BLUE}Using fallback text:${RESET}`, fallbackText);
      return fallbackText;
    }
  }
}

// Main Character Generator DSL Graph System
class CharacterGeneratorDSLGraph {
  private graphBuilder: GraphBuilder;
  private graph: Graph;

  constructor(
    private apiKey: string,
    private modelName: string,
    private voiceName: string,
    private llmProvider: string,
  ) {}

  async initialize() {
    console.log(`${GREEN}Creating graph using DSL...${RESET}`);
    this.graphBuilder = new GraphBuilder({
      id: 'character_generator_dsl_graph',
      apiKey: this.apiKey,
      enableRemoteConfig: true,
    });

    // Create and add custom nodes (class-based)
    const inputRouterNode = new InputRouterNode();
    const assetsFetcherNode = new CharacterAssetsFetcherNode();
    const questFetcherNode = new CharacterQuestFetcherNode();
    const stateCollectorNode = new StateCollectorNode();
    const characterComposerNode = new CharacterComposerNode({
      reportToClient: true,
    });
    const characterDeployerNode = new CharacterDeployerNode({
      reportToClient: true,
    });
    const characterSelectorNode = new CharacterSelectorNode();
    const responseGeneratorNode = new CharacterResponseGeneratorNode();
    const historyLoggerNode = new HistoryLoggerNode();
    const ttsTextExtractorNode = new TTSTextExtractorNode({
      reportToClient: true,
    });

    const llmComponent = new RemoteLLMComponent({
      id: 'llm-component',
      provider: this.llmProvider,
      modelName: this.modelName,
      defaultConfig: TEXT_CONFIG_SDK,
    });

    // Create LLM nodes
    const llmNode = new RemoteLLMChatNode({
      id: 'llm-node',
      llmComponent,
      stream: true,
    });

    const textAggregatorNode = new TextAggregatorNode({
      id: 'text-aggregator-node',
      reportToClient: true,
    });

    const textChunkingNode = new TextChunkingNode({
      id: 'text-chunking-node',
    });

    const llmAssetsNode = new RemoteLLMChatNode({
      id: 'llm-assets-node',
      llmComponent,
      stream: false,
    });

    const llmQuestsNode = new RemoteLLMChatNode({
      id: 'llm-quests-node',
      llmComponent,
      stream: false,
    });

    const ttsComponent = new RemoteTTSComponent({
      id: 'tts-component',
      synthesisConfig: {
        type: 'inworld',
        config: {
          modelId: DEFAULT_TTS_MODEL_ID,
          postprocessing: {
            sampleRate: SAMPLE_RATE,
          },
          inference: {
            temperature: 0.7,
            speakingRate: 1.0,
          },
        },
      },
    });

    // Create TTS node
    const ttsNode = new RemoteTTSNode({
      id: 'tts-node',
      ttsComponent,
      speakerId: this.voiceName,
      modelId: DEFAULT_TTS_MODEL_ID,
    });

    // Add components to graph
    this.graphBuilder.addComponent(llmComponent).addComponent(ttsComponent);

    // Add all nodes to graph
    this.graphBuilder
      .addNode(inputRouterNode)
      .addNode(assetsFetcherNode)
      .addNode(questFetcherNode)
      .addNode(stateCollectorNode)
      .addNode(characterComposerNode)
      .addNode(characterDeployerNode)
      .addNode(characterSelectorNode)
      .addNode(responseGeneratorNode)
      .addNode(historyLoggerNode)
      .addNode(ttsTextExtractorNode)
      .addNode(llmNode)
      .addNode(textAggregatorNode)
      .addNode(textChunkingNode)
      .addNode(llmAssetsNode)
      .addNode(llmQuestsNode)
      .addNode(ttsNode);

    // Create edges using DSL approach with conditions
    // Create flow edges
    this.graphBuilder
      .addEdge(inputRouterNode, assetsFetcherNode, {
        conditionExpression: 'input.type == "instruct"',
      })
      .addEdge(assetsFetcherNode, llmAssetsNode)
      .addEdge(inputRouterNode, questFetcherNode, {
        conditionExpression: 'input.type == "instruct"',
      })
      .addEdge(questFetcherNode, llmQuestsNode)
      .addEdge(inputRouterNode, stateCollectorNode, {
        conditionExpression: 'input.type == "instruct"',
      })
      .addEdge(llmAssetsNode, stateCollectorNode)
      .addEdge(llmQuestsNode, stateCollectorNode)
      .addEdge(stateCollectorNode, characterComposerNode)
      .addEdge(characterComposerNode, characterDeployerNode);

    // Select flow edges
    this.graphBuilder
      .addEdge(inputRouterNode, characterSelectorNode, {
        conditionExpression: 'input.type == "select"',
      })
      .addEdge(characterSelectorNode, ttsTextExtractorNode, {
        conditionExpression: 'input.name != ""',
      })
      .addEdge(ttsTextExtractorNode, ttsNode, {
        optional: true,
      });

    // Chat flow edges
    this.graphBuilder
      .addEdge(inputRouterNode, responseGeneratorNode, {
        conditionExpression: 'input.type == "chat"',
      })
      .addEdge(responseGeneratorNode, llmNode)
      .addEdge(llmNode, textAggregatorNode)
      .addEdge(textAggregatorNode, historyLoggerNode)
      .addEdge(llmNode, textChunkingNode)
      .addEdge(textChunkingNode, ttsNode, {
        optional: true,
      })
      .addEdge(inputRouterNode, historyLoggerNode, {
        conditionExpression: 'input.type == "chat"',
      });

    // Set start and end nodes
    this.graphBuilder
      .setStartNode(inputRouterNode)
      .setEndNode(characterDeployerNode)
      .setEndNode(characterSelectorNode)
      .setEndNode(ttsNode);

    console.log(
      `${GREEN}Character Generator DSL Graph initialized successfully!${RESET}`,
    );
    console.log(`${BLUE}Commands:${RESET}`);
    console.log(
      `${BLUE}  create:<setting> - Create characters for a setting${RESET}`,
    );
    console.log(
      `${BLUE}  select:<character-name> - Select a character to chat with${RESET}`,
    );
    console.log(`${BLUE}  <message> - Chat with selected character${RESET}`);
    console.log(`${BLUE}  quit - Exit the system${RESET}`);

    this.graph = this.graphBuilder.build();
  }

  async processInput(input: TextInput): Promise<void> {
    try {
      const userId = v7();
      const userContext: UserContextInterface = {
        attributes: {
          user_id: userId,
          age: '48',
        },
        targetingKey: userId,
      };

      const { outputStream } = await this.graph.start(input, { userContext });

      for await (const result of outputStream) {
        await this.handleOutput(result);
      }

      console.log(`${GREEN}Input processed successfully!${RESET}`);
    } catch (error) {
      console.error(`${RED}Error processing input: ${error}${RESET}`);
    }
  }

  private async handleOutput(result: any): Promise<void> {
    await result.processResponse({
      TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
        console.log(`${BLUE}🎵 Processing TTS audio stream...${RESET}`);
        await this.handleTTSOutput(ttsStream);
      },
      Custom: (data: any) => {
        console.log(`${BLUE}📋 Processing JSON data...${RESET}`);
        console.log(
          `${GREEN}JSON Result:${RESET}`,
          JSON.stringify(data, null, 2),
        );
      },
      string: (data: string) => {
        console.log(`${BLUE}🔤 Processing text data...${RESET}`);
        console.log(`${GREEN}Text Result: ${data}${RESET}`);
      },
      default: (data: any) => {
        console.log(`${BLUE}❓ Processing unknown output type${RESET}`);
        if (data) {
          console.log(
            `${GREEN}Unknown Data:${RESET}`,
            JSON.stringify(data, null, 2),
          );
        }
      },
    });
  }

  private async handleTTSOutput(
    ttsStream: GraphTypes.TTSOutputStream,
  ): Promise<void> {
    try {
      const audioBuffers: Buffer[] = [];
      for await (const chunk of ttsStream) {
        if (chunk.audio?.data) {
          const buffer = Buffer.from(chunk.audio?.data, 'base64');
          audioBuffers.push(buffer);
        }
      }

      const mergedBuffer = Buffer.concat(audioBuffers);
      const floatSamples = new Float32Array(
        mergedBuffer.buffer,
        mergedBuffer.byteOffset,
        mergedBuffer.length / 4,
      );

      // Create audio file
      const audio = {
        sampleRate: SAMPLE_RATE,
        channelData: [floatSamples],
      };

      const buffer = await wavEncoder.encode(audio);
      if (!fs.existsSync(OUTPUT_DIRECTORY)) {
        fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
      }

      // Use current character name if available
      const characterName = gameState.currentCharacter?.name || 'character';
      const audioFile = path.join(
        OUTPUT_DIRECTORY,
        `${characterName}_${Date.now()}.wav`,
      );
      fs.writeFileSync(audioFile, Buffer.from(buffer));

      console.log(
        `${BLUE}🎵 Playing ${characterName}'s voice... (${audioFile})${RESET}`,
      );

      // Play the audio file (platform-specific)
      const platform = process.platform;
      if (platform === 'darwin') {
        spawn('afplay', [audioFile], { stdio: 'ignore' });
      } else if (platform === 'linux') {
        spawn('aplay', [audioFile], { stdio: 'ignore' });
      } else if (platform === 'win32') {
        spawn('start', [audioFile], { stdio: 'ignore', shell: true });
      }
    } catch (error) {
      console.error(`${RED}Error handling TTS output: ${error}${RESET}`);
    }
  }

  async cleanup(): Promise<void> {
    if (this.graph) {
      this.graph = null;
    }
    if (this.graphBuilder) {
      this.graphBuilder = null;
    }
    telemetry.shutdownTelemetry();
  }
}

const usage = `
Usage:
    yarn character-generator [options]
    
Options:
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}]
    --voiceName=<voice-id>[optional, default=${DEFAULT_VOICE_ID}]
    
Examples:
    yarn character-generator
    yarn character-generator --voiceName=Ashley
    
Interactive Commands:
    create:futuristic world full of cats and robots
    create:medieval world full of knights and castles
    select:Character-1
    Hello, what's your quest?
    quit
`;

let characterGraph: CharacterGeneratorDSLGraph | null = null;

async function main() {
  const { modelName, voiceName, apiKey, llmProvider } = parseArgs();

  characterGraph = new CharacterGeneratorDSLGraph(
    apiKey,
    modelName,
    voiceName,
    llmProvider,
  );
  await characterGraph.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(`${BLUE}Enter input: ${RESET}`, (answer) => {
        resolve(answer);
      });
    });
  };

  try {
    while (true) {
      const userInput = await askQuestion();
      if (userInput.trim().toLowerCase() === 'quit') {
        break;
      }
      await characterGraph.processInput({ text: userInput });
    }
  } catch (error) {
    console.error(`${RED}Error: ${error}${RESET}`);
  } finally {
    rl.close();
    await characterGraph.cleanup();
    stopInworldRuntime();
  }
}

function parseArgs(): {
  modelName: string;
  voiceName: string;
  llmProvider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const voiceName = argv.voiceName || DEFAULT_VOICE_ID;
  const llmProvider = argv.llmProvider || DEFAULT_LLM_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { modelName, voiceName, apiKey, llmProvider };
}

function done() {
  if (characterGraph) {
    characterGraph.cleanup();
  }
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: err.context,
    });
  } else {
    console.error(err);
  }
  if (characterGraph) {
    characterGraph.cleanup();
  }
  process.exit(1);
});

// Run the main function
main().catch(console.error);
