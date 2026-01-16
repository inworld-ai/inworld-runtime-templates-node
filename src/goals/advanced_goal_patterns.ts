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
    npm run advanced-goal-patterns "I need help with my account" --  \\n
    --provider=<service-provider>[optional, default=groq] \\n
    --modelName=<model-name>[optional, default=llama-3.3-70b-versatile] \\n
    --scenario=<customer_support|multi_goal|repeatable>[optional, default=customer_support]

Description:
    This template demonstrates advanced goal advancement patterns:
    
    1. customer_support: Multiple concurrent goals with different priorities
    2. multi_goal: Complex goal dependencies and branching logic
    3. repeatable: Repeatable goals for recurring tasks
    
    Each scenario shows different ways to structure goals for various use cases.

Examples:
    # Customer support scenario with concurrent goals
    npm run advanced-goal-patterns "I need to reset my password" -- --scenario=customer_support
    
    # Multi-goal scenario with complex dependencies
    npm run advanced-goal-patterns "I want to start the onboarding" -- --scenario=multi_goal
    
    # Repeatable goals scenario
    npm run advanced-goal-patterns "What's the weather?" -- --scenario=repeatable
`;

run();

async function run() {
  const { userMessage, provider, modelName, apiKey, scenario } = parseArgs();

  console.log('\n=== Advanced Goal Patterns Example ===\n');
  console.log('Scenario:', scenario);
  console.log('User message:', userMessage);
  console.log('\n');

  // Create LLM component
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

  // Get goals based on scenario
  const goals = getGoalsForScenario(scenario);

  console.log(`\nGoals for ${scenario} scenario:`);
  goals.forEach((goal, index) => {
    console.log(`${index + 1}. ${goal.name}: ${goal.motivation}`);
    if (goal.repeatable) {
      console.log('   (repeatable)');
    }
  });
  console.log('\n');

  // Create the goal advancement node
  const goalNode = new GoalAdvancementNode({
    id: 'goal_advancement_node',
    creationConfig: {
      goals,
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
    id: 'advanced_goal_patterns_graph',
    enableRemoteConfig: false,
    apiKey,
  })
    .addComponent(llmComponent)
    .addNode(goalNode)
    .setStartNode(goalNode)
    .setEndNode(goalNode)
    .build();

  const goalAdvancementRequest = {
    eventHistory: getEventHistoryForScenario(scenario),
    beliefState: getBeliefStateForScenario(scenario),
    agentInfo: getAgentInfoForScenario(scenario),
    playerInfo: {
      name: 'User',
      description: 'A user interacting with the system',
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

  // Process results
  for await (const result of outputStream) {
    await result.processResponse({
      GoalAdvancement: (response: any) => {
        console.log('📊 Goal Advancement Result:');
        console.log('═'.repeat(60));

        if (response.activatedGoals.length > 0) {
          console.log('\n✅ Newly Activated Goals:');
          response.activatedGoals.forEach((goal: string) => {
            const goalDef = goals.find((g) => g.name === goal);
            console.log(`   • ${goal}`);
            if (goalDef?.motivation) {
              console.log(`     Motivation: ${goalDef.motivation}`);
            }
          });
        }

        if (response.completedGoals.length > 0) {
          console.log('\n✓ Completed Goals:');
          response.completedGoals.forEach((goal: string) => {
            console.log(`   • ${goal}`);
          });
        }

        if (response.currentGoals.length > 0) {
          console.log('\n🎯 Currently Active Goals:');
          response.currentGoals.forEach((goal: string) => {
            const goalDef = goals.find((g) => g.name === goal);
            console.log(`   • ${goal}`);
            if (goalDef?.activationCondition?.requiredGoals) {
              console.log(
                `     Dependencies: ${goalDef.activationCondition.requiredGoals.join(', ')}`,
              );
            }
          });
        }

        if (
          response.beliefState &&
          Object.keys(response.beliefState).length > 0
        ) {
          console.log('\n💭 Updated Belief State:');
          console.log(JSON.stringify(response.beliefState, null, 2));
        }

        console.log('\n' + '═'.repeat(60));

        // Scenario-specific insights
        printScenarioInsights(scenario, response);
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
 * Get goals configuration for a specific scenario
 *
 * @param {string} scenario - The scenario name
 * @returns {Array} Array of goal configurations
 */
function getGoalsForScenario(scenario: string): any[] {
  switch (scenario) {
    case 'customer_support':
      return [
        {
          name: 'identify_issue',
          motivation: 'Understand the customer problem or request',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: [],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Customer has clearly stated their issue or request',
          },
        },
        {
          name: 'verify_account',
          motivation: 'Verify customer account for security',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['identify_issue'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Customer account has been verified',
          },
        },
        {
          name: 'gather_details',
          motivation: 'Collect additional information needed to resolve issue',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['verify_account'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'All necessary details have been collected',
          },
        },
        {
          name: 'provide_solution',
          motivation: 'Offer solution or resolution to customer',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['gather_details'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Solution has been provided to customer',
          },
        },
        {
          name: 'confirm_satisfaction',
          motivation: 'Ensure customer is satisfied with resolution',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['provide_solution'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Customer confirms they are satisfied',
          },
        },
      ];

    case 'multi_goal':
      return [
        {
          name: 'welcome_user',
          motivation: 'Welcome the user and start onboarding',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: [],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User has been welcomed',
          },
        },
        {
          name: 'explain_features',
          motivation: 'Explain key product features',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['welcome_user'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Features have been explained',
          },
        },
        {
          name: 'setup_profile',
          motivation: 'Help user set up their profile',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['welcome_user'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User profile has been set up',
          },
        },
        {
          name: 'configure_preferences',
          motivation: 'Configure user preferences and settings',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['setup_profile', 'explain_features'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Preferences have been configured',
          },
        },
        {
          name: 'complete_onboarding',
          motivation: 'Finalize onboarding process',
          repeatable: false,
          activationCondition: {
            intents: [],
            requiredGoals: ['configure_preferences'],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Onboarding has been completed',
          },
        },
      ];

    case 'repeatable':
      return [
        {
          name: 'answer_question',
          motivation: 'Answer user questions about any topic',
          repeatable: true,
          activationCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User asks a question',
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Question has been answered completely',
          },
        },
        {
          name: 'provide_example',
          motivation: 'Provide examples when user requests clarification',
          repeatable: true,
          activationCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'User requests an example or clarification',
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Example has been provided',
          },
        },
        {
          name: 'offer_help',
          motivation: 'Proactively offer additional help',
          repeatable: true,
          activationCondition: {
            intents: [],
            requiredGoals: [],
          },
          completionCondition: {
            intents: [],
            requiredGoals: [],
            detect: 'Help has been offered',
          },
        },
      ];

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

/**
 * Get event history for a scenario
 *
 * @param {string} scenario - The scenario name
 * @returns {Array} Event history
 */
function getEventHistoryForScenario(scenario: string): any[] {
  switch (scenario) {
    case 'customer_support':
      return [
        {
          event_variant: {
            agent_speech: {
              agent_name: 'SupportAgent',
              utterance: 'Hello! How can I help you today?',
            },
          },
        },
      ];
    case 'multi_goal':
      return [
        {
          event_variant: {
            agent_speech: {
              agent_name: 'OnboardingAgent',
              utterance: 'Welcome! Let me help you get started.',
            },
          },
        },
      ];
    case 'repeatable':
      return [];
    default:
      return [];
  }
}

/**
 * Get belief state for a scenario
 *
 * @param {string} scenario - The scenario name
 * @returns {Object} Belief state
 */
function getBeliefStateForScenario(scenario: string): any {
  switch (scenario) {
    case 'customer_support':
      return {
        support_session_started: true,
        timestamp: new Date().toISOString(),
      };
    case 'multi_goal':
      return {
        onboarding_started: true,
        user_type: 'new',
      };
    case 'repeatable':
      return {
        questions_answered: 0,
      };
    default:
      return {};
  }
}

/**
 * Get agent info for a scenario
 *
 * @param {string} scenario - The scenario name
 * @returns {Object} Agent info
 */
function getAgentInfoForScenario(scenario: string): any {
  switch (scenario) {
    case 'customer_support':
      return {
        name: 'SupportAgent',
        description:
          'A helpful customer support agent specialized in resolving user issues',
      };
    case 'multi_goal':
      return {
        name: 'OnboardingAgent',
        description:
          'An onboarding specialist that helps new users get started with the platform',
      };
    case 'repeatable':
      return {
        name: 'AssistantBot',
        description:
          'A helpful assistant that answers questions and provides information',
      };
    default:
      return {
        name: 'Agent',
        description: 'A helpful agent',
      };
  }
}

/**
 * Print scenario-specific insights
 *
 * @param {string} scenario - The scenario name
 * @param {any} response - The goal advancement response
 */
function printScenarioInsights(scenario: string, response: any): void {
  console.log('\n💡 Scenario Insights:');

  switch (scenario) {
    case 'customer_support':
      console.log('   Customer support follows a linear flow:');
      console.log('   identify → verify → gather → solve → confirm');
      if (response.currentGoals.includes('verify_account')) {
        console.log('\n   ⚠️  Next: Verify customer account before proceeding');
      }
      break;

    case 'multi_goal':
      console.log('   Onboarding uses parallel and sequential goals:');
      console.log(
        '   welcome → (features || profile) → preferences → complete',
      );
      if (
        response.currentGoals.includes('explain_features') ||
        response.currentGoals.includes('setup_profile')
      ) {
        console.log(
          '\n   ℹ️  Multiple goals can be active simultaneously (features & profile)',
        );
      }
      break;

    case 'repeatable':
      console.log('   This scenario demonstrates repeatable goals that can');
      console.log('   activate multiple times for recurring interactions.');
      if (response.completedGoals.length > 0) {
        console.log(
          `\n   ✓ ${response.completedGoals.length} goal completion(s) so far`,
        );
        console.log(
          '     (Repeatable goals can be activated again after completion)',
        );
      }
      break;
  }
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
  scenario: string;
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
  const scenario = argv.scenario || 'customer_support';

  const validScenarios = ['customer_support', 'multi_goal', 'repeatable'];
  if (!validScenarios.includes(scenario)) {
    throw new Error(
      `Invalid scenario: ${scenario}. Valid options are: ${validScenarios.join(', ')}\n${usage}`,
    );
  }

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
    scenario,
  };
}
