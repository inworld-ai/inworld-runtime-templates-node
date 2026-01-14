import 'dotenv/config';

import { stopInworldRuntime } from '@inworld/runtime';
import {
  GoalAdvancementNode,
  GraphBuilder,
  GraphTypes,
  RemoteLLMComponent,
} from '@inworld/runtime/graph';

const minimist = require('minimist');

const usage = `
Usage:
    yarn basic-goal-advancement "I'm 25 years old" \\n
    --provider=<service-provider>[optional, default=groq] \\n
    --modelName=<model-name>[optional, default=llama-3.3-70b-versatile]

Description:
    This template demonstrates how to use the GoalAdvancementNode to track and manage
    conversational goals. The agent will:
    1. Ask for your age (first goal)
    2. Ask for your favorite color after you provide your age (second goal)
    3. Say goodbye after both goals are completed (third goal)
    
    Goals are tracked with activation and completion conditions, and the agent
    uses an LLM to determine when goals are activated or completed based on the
    conversation context.

Examples:
    # Start the conversation - agent will ask for your age
    yarn basic-goal-advancement "Hello"
    
    # Provide your age - will activate favorite color question
    yarn basic-goal-advancement "I'm 25 years old"
    
    # Provide your favorite color - will activate goodbye goal
    yarn basic-goal-advancement "My favorite color is blue"
`;

run();

async function run() {
  const { userMessage, provider, modelName, apiKey } = parseArgs();

  console.log('\n=== Goal Advancement Example ===\n');
  console.log('User message:', userMessage);
  console.log('\n');

  // Create LLM component for goal advancement
  const llmComponent = new RemoteLLMComponent({
    id: 'llm_component',
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

  // Create the goal advancement node
  const goalNode = new GoalAdvancementNode({
    id: 'goal_advancement_node',
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
          motivation: 'Say goodbye to the user',
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
      llm_component_id: 'llm_component',
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

  // Build the graph
  const graph = new GraphBuilder({
    id: 'goal_advancement_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(llmComponent)
    .addNode(goalNode)
    .setStartNode(goalNode)
    .setEndNode(goalNode)
    .build();

  // Create the goal advancement request (plain object)
  const goalAdvancementRequest = {
    eventHistory: [
      {
        agentSpeech: {
          agentName: 'Assistant',
          utterance: 'Hello! How are you today?',
        },
      },
    ],
    beliefState: {},
    agentInfo: {
      name: 'Assistant',
      description:
        'A friendly assistant that asks questions to learn about users',
    },
    playerInfo: {
      name: 'User',
      description: 'A user having a conversation',
    },
    queryEvent: {
      playerQuery: userMessage,
      intents: [] as any[],
    },
    goalsForEvaluationOverride: [] as any[],
  };

  // Wrap in GoalAdvancementRequest class for proper proto serialization
  const requestWrapper = new GraphTypes.GoalAdvancementRequest(
    goalAdvancementRequest,
  );

  // Execute the graph
  const { outputStream } = await graph.start(requestWrapper);

  // Process the results
  for await (const result of outputStream) {
    await result.processResponse({
      GoalAdvancement: (response: any) => {
        console.log('📊 Goal Advancement Result:');
        console.log('─'.repeat(50));

        if (response.activatedGoals.length > 0) {
          console.log('\n✅ Activated Goals:');
          response.activatedGoals.forEach((goal: string) => {
            console.log(`   • ${goal}`);
          });
        }

        if (response.completedGoals.length > 0) {
          console.log('\n✓ Completed Goals:');
          response.completedGoals.forEach((goal: string) => {
            console.log(`   • ${goal}`);
          });
        }

        if (response.currentGoals.length > 0) {
          console.log('\n🎯 Current Active Goals:');
          response.currentGoals.forEach((goal: string) => {
            console.log(`   • ${goal}`);
          });
        }

        if (
          response.beliefState &&
          Object.keys(response.beliefState).length > 0
        ) {
          console.log('\n💭 Belief State:');
          console.log(JSON.stringify(response.beliefState, null, 2));
        }

        console.log('\n' + '─'.repeat(50));

        // Provide next step guidance
        if (response.currentGoals.includes('age_question')) {
          console.log('\n💡 Next: Share your age to progress to the next goal');
        } else if (response.currentGoals.includes('favorite_color_question')) {
          console.log(
            '\n💡 Next: Share your favorite color to complete the survey',
          );
        } else if (response.currentGoals.includes('say_goodbye')) {
          console.log(
            '\n💡 All questions answered! The agent will say goodbye.',
          );
        }

        if (
          response.activatedGoals.length === 0 &&
          response.completedGoals.length === 0
        ) {
          console.log('\n⚠️  No goal changes detected in this interaction');
        }
      },
      default: (data: any) => {
        console.error('Unprocessed response:', data);
      },
      error: (error: any) => {
        throw new Error(error.message);
      },
    });
  }

  console.log('\n');
  stopInworldRuntime();
}

/**
 * Parse command line arguments
 *
 * @returns {Object} Parsed arguments
 */
function parseArgs(): {
  userMessage: string;
  provider: string;
  modelName: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const userMessage = argv._?.join(' ') || '';
  const provider = argv.provider || 'groq';
  const modelName = argv.modelName || 'llama-3.3-70b-versatile';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!userMessage) {
    throw new Error(`You need to provide a user message.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return {
    userMessage,
    provider,
    modelName,
    apiKey,
  };
}
