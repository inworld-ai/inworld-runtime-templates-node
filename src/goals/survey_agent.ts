import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  AgentSpeech,
  GoalAdvancementNode,
  GoalAdvancementRequest,
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
  RemoteLLMComponent,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

const usage = `
Usage:
    npm run survey-agent -- \\n
    --provider=<service-provider>[optional, default=groq] \\n
    --modelName=<model-name>[optional, default=llama-3.3-70b-versatile]

Description:
    This template demonstrates a complete survey agent that uses goal advancement
    to guide a multi-turn conversation. The agent will:
    1. Ask for your age
    2. Ask for your favorite color after age is provided
    3. Say goodbye after both questions are answered
    
    This example shows how to integrate GoalAdvancementNode with LLMChatNode
    to create a natural conversational flow driven by goal state.

Examples:
    npm run survey-agent
`;

run();

/**
 * Survey agent state to track conversation
 */
interface SurveyState {
  currentGoals: string[];
  completedGoals: string[];
  activatedGoals: string[];
  beliefState: any;
  conversationHistory: AgentSpeech[];
}

async function run() {
  const { provider, modelName, apiKey } = parseArgs();

  console.log('\n=== Survey Agent with Goal Advancement ===\n');
  console.log(
    'The agent will guide you through a short survey using goal-driven conversation.',
  );
  console.log('Type your answers and press Enter.\n');
  console.log('─'.repeat(60));
  console.log('\n');

  // Initialize survey state
  const surveyState: SurveyState = {
    currentGoals: [],
    completedGoals: [],
    activatedGoals: [],
    beliefState: {},
    conversationHistory: [],
  };

  // Create LLM component for goal advancement
  const llmComponent = new RemoteLLMComponent({
    id: 'llm_interface',
    provider,
    modelName,
    defaultConfig: {
      maxNewTokens: 160,
      maxPromptLength: 8000,
      temperature: 0.7,
      topP: 0.95,
      repetitionPenalty: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
      stopSequences: ['\n\n'],
    },
  });

  // Create LLM chat node for response generation
  const llmChatNode = new RemoteLLMChatNode({
    id: 'llm_chat',
    provider,
    modelName,
    stream: false,
    textGenerationConfig: {
      maxNewTokens: 200,
      temperature: 0.8,
    },
  });

  // Note: This example doesn't use TransformNode, but generates prompts dynamically
  // based on the current goal state in the generateResponse() function

  // Create the goal advancement node
  const goalNode = new GoalAdvancementNode({
    id: 'goal_advancement',
    creationConfig: {
      goals: [
        {
          name: 'age_question',
          motivation: 'Ask the user for their age',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: [],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User shares their age',
          },
        },
        {
          name: 'favorite_color_question',
          motivation: 'Ask the user for their favorite color',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['age_question'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User shares their favorite color',
          },
        },
        {
          name: 'say_goodbye',
          motivation: 'Thank the user and say goodbye',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['age_question', 'favorite_color_question'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Agent has said goodbye',
          },
        },
      ],
    },
    executionConfig: {
      llm_component_id: 'llm_interface',
      text_generation_config: {
        maxNewTokens: 160,
        maxPromptLength: 8000,
        temperature: 0.7,
        topP: 0.95,
        repetitionPenalty: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
        stopSequences: ['\n\n'],
      },
    },
  });

  // Build the goal advancement graph
  const goalGraph = new GraphBuilder({
    id: 'goal_advancement_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(llmComponent)
    .addNode(goalNode)
    .setStartNode(goalNode)
    .setEndNode(goalNode)
    .build();

  // Build the response generation graph
  const chatGraph = new GraphBuilder({
    id: 'chat_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addNode(llmChatNode)
    .setStartNode(llmChatNode)
    .setEndNode(llmChatNode)
    .build();

  // Interactive conversation loop
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  /**
   * Process goal advancement for user input
   *
   * @param {string} userInput - The user's message
   */
  async function processGoalAdvancement(userInput: string): Promise<void> {
    // Build event history from conversation
    const eventHistory = surveyState.conversationHistory;

    // Create goal advancement request (plain object)
    const goalAdvancementRequest: GoalAdvancementRequest = {
      eventHistory: eventHistory.slice(-10), // Last 10 messages
      beliefState: surveyState.beliefState,
      agentInfo: {
        name: 'SurveyBot',
        description: 'A friendly survey agent that asks questions',
      },
      playerInfo: {
        name: 'User',
        description: 'A user participating in the survey',
      },
      event: {
        playerQuery: userInput,
        intents: [] as any[],
      },
      goalsForEvaluationOverride: [] as any[],
    };

    // Wrap in GoalAdvancementRequest class for proper proto serialization
    const requestWrapper = new GraphTypes.GoalAdvancementRequest(
      goalAdvancementRequest,
    );

    // Execute goal advancement
    const { outputStream } = await goalGraph.start(requestWrapper);

    for await (const result of outputStream) {
      await result.processResponse({
        GoalAdvancement: (response: any) => {
          // Update survey state
          surveyState.currentGoals = response.currentGoals;
          surveyState.completedGoals = [
            ...surveyState.completedGoals,
            ...response.completedGoals,
          ];
          surveyState.activatedGoals = response.activatedGoals;
          surveyState.beliefState = response.beliefState || {};

          // Log goal changes
          if (response.activatedGoals.length > 0) {
            console.log('\n✅ New goal activated:', response.activatedGoals[0]);
          }
          if (response.completedGoals.length > 0) {
            console.log('✓ Goal completed:', response.completedGoals[0]);
          }
        },
        error: (error: any) => {
          throw new Error(error.message);
        },
      });
    }
  }

  /**
   * Generate agent response based on current goals
   *
   * @returns {Promise<string>} The agent's response
   */
  async function generateResponse(): Promise<string> {
    let prompt = '';

    if (surveyState.currentGoals.includes('age_question')) {
      prompt = 'Ask the user for their age in a friendly, conversational way.';
    } else if (surveyState.currentGoals.includes('favorite_color_question')) {
      prompt = 'Ask the user for their favorite color in a friendly way.';
    } else if (surveyState.currentGoals.includes('say_goodbye')) {
      prompt = 'Thank the user for participating and say goodbye warmly.';
    } else {
      prompt = 'Greet the user and introduce yourself as a survey agent.';
    }

    const chatRequest = new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: 'system',
          content: `You are SurveyBot, a friendly survey agent. ${prompt} Keep your response concise (1-2 sentences).`,
        },
        {
          role: 'user',
          content: 'Generate your response.',
        },
      ],
    });

    const { outputStream } = await chatGraph.start(chatRequest);
    let responseText = '';

    for await (const result of outputStream) {
      await result.processResponse({
        Content: (response: any) => {
          responseText = response.content;
        },
        error: (error: any) => {
          throw new Error(error.message);
        },
      });
    }

    return responseText;
  }

  /**
   * Main conversation loop
   */
  async function conversationLoop(): Promise<void> {
    // Start with initial greeting
    const greeting = await generateResponse();
    console.log(`\n🤖 Agent: ${greeting}\n`);
    surveyState.conversationHistory.push({
      agentName: 'SurveyBot',
      utterance: greeting,
    });

    // Initialize with first goal
    await processGoalAdvancement('Hello');

    /**
     * Handle user input
     *
     * @param {string} input - User input
     */
    const handleInput = async (input: string) => {
      if (!input.trim()) {
        rl.prompt();
        return;
      }

      // Record user message
      surveyState.conversationHistory.push({
        agentName: 'User',
        utterance: input,
      });

      // Process goal advancement
      await processGoalAdvancement(input);

      // Check if survey is complete
      if (surveyState.currentGoals.includes('say_goodbye')) {
        const finalResponse = await generateResponse();
        console.log(`\n🤖 Agent: ${finalResponse}\n`);
        surveyState.conversationHistory.push({
          agentName: 'SurveyBot',
          utterance: finalResponse,
        });

        console.log('─'.repeat(60));
        console.log('\n✅ Survey completed!');
        console.log(
          '\nCompleted goals:',
          surveyState.completedGoals.join(', '),
        );
        console.log('\n');

        rl.close();
        stopInworldRuntime();
        return;
      }

      // Generate agent response based on current goals
      const agentResponse = await generateResponse();
      console.log(`\n🤖 Agent: ${agentResponse}\n`);
      surveyState.conversationHistory.push({
        agentName: 'SurveyBot',
        utterance: agentResponse,
      });

      rl.prompt();
    };

    rl.setPrompt('👤 You: ');
    rl.prompt();

    rl.on('line', handleInput);

    rl.on('close', () => {
      console.log('\nGoodbye!');
      stopInworldRuntime();
      process.exit(0);
    });
  }

  await conversationLoop();
}

/**
 * Parse command line arguments
 *
 * @returns {Object} Parsed arguments
 */
function parseArgs(): {
  provider: string;
  modelName: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const provider = argv.provider || 'groq';
  const modelName = argv.modelName || 'llama-3.3-70b-versatile';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    provider,
    modelName,
    apiKey,
  };
}
