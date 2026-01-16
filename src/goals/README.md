# Goal Advancement Templates

This directory contains templates demonstrating the use of the GoalAdvancementNode to create goal-driven conversational agents.

## What is Goal Advancement?

Goal advancement is a powerful feature that allows agents to track and manage conversational objectives. Goals can have:
- **Activation conditions**: When the goal should become active
- **Completion conditions**: When the goal is satisfied
- **Required goals**: Dependencies on other goals
- **Motivation**: Why the agent is pursuing this goal

The GoalAdvancementNode uses an LLM to evaluate the conversation context and automatically determine when goals should be activated or completed.

## Templates

### `basic_goal_advancement.ts`

A simple example demonstrating sequential goal progression in a survey-style conversation.

**What it does:**
- Tracks three sequential goals: asking for age, asking for favorite color, and saying goodbye
- Uses goal dependencies to ensure proper conversation flow
- Maintains belief state across goal transitions

**Usage:**
```bash
# Start the conversation
npm run basic-goal-advancement "Hello"

# Provide your age
npm run basic-goal-advancement "I'm 25 years old"

# Provide your favorite color
npm run basic-goal-advancement "My favorite color is blue"
```

## Key Concepts

### Goal Structure

Each goal consists of:

```typescript
{
  name: string;                    // Unique identifier for the goal
  motivation?: string;             // Why the agent is pursuing this goal
  repeatable?: boolean;            // Can the goal be activated multiple times?
  activation_condition?: {
    intents?: string[];            // Intent matches that can activate the goal
    required_goals?: string[];     // Goals that must be completed first
    detect?: string;               // Natural language condition for activation
  };
  completion_condition?: {
    intents?: string[];            // Intent matches that can complete the goal
    required_goals?: string[];     // Goals that must be completed first
    detect?: string;               // Natural language condition for completion
  };
}
```

### Goal Advancement Request

The GoalAdvancementNode requires a `GoalAdvancementRequest` input containing:

```typescript
{
  event_history: Event[];          // Previous conversation events
  belief_state: object;            // Current belief state (JSON object)
  agent_info: {
    name: string;
    description: string;
  };
  player_info: {
    name: string;
    description: string;
  };
  event: {                         // Current triggering event
    query_event?: {                // User query
      player_query: string;
      intents?: IntentMatch[];
    };
    response_event?: {             // Agent response
      player_query: string;
      agent_response: string;
    };
    trigger_event?: {              // External trigger
      trigger_name: string;
    };
  };
  goals_for_evaluation_override?: Goal[];  // Optional runtime goal override
}
```

### Goal Advancement Response

The node outputs a `GoalAdvancement` result containing:

```typescript
{
  activatedGoals: string[];        // Goals that were newly activated
  completedGoals: string[];        // Goals that were completed
  currentGoals: string[];          // All currently active goals
  beliefState: object;             // Updated belief state
}
```

## Common Patterns

### Sequential Goals

Use `required_goals` to create a sequence:

```typescript
{
  name: 'step_2',
  activation_condition: {
    required_goals: ['step_1']  // Only activate after step_1 completes
  }
}
```

### Intent-Based Completion

Combine with intent matching for precise control:

```typescript
{
  name: 'greeting',
  completion_condition: {
    intents: ['farewell_intent']  // Complete when farewell detected
  }
}
```

### Natural Language Conditions

Use the `detect` field for flexible LLM-based evaluation:

```typescript
{
  name: 'collect_email',
  completion_condition: {
    detect: 'User provides a valid email address'
  }
}
```

### Repeatable Goals

For recurring objectives:

```typescript
{
  name: 'answer_question',
  repeatable: true,  // Can be activated multiple times
  completion_condition: {
    detect: 'User question has been answered'
  }
}
```

## Integration with Other Nodes

### With LLM Chat Node

Use goal advancement to guide conversation generation:

```typescript
// Goal advancement determines what to ask
// LLM chat node generates the actual response
graph
  .addGoalAdvancementNode('goals', { ... })
  .addLLMChatNode('chat', { ... })
  .addEdge('goals', 'chat')
```

### With Transform Node

Extract specific information from goal advancement:

```typescript
// Transform node can extract current goals for routing
graph
  .addGoalAdvancementNode('goals', { ... })
  .addTransformNode('extract_current_goal', {
    outputType: 'Text',
    outputTemplate: 'input.current_goals[0]'
  })
```

### With Intent Matcher

Combine intent detection with goal tracking:

```typescript
// Intent matcher provides intent context
// Goal advancement uses intents for completion
graph
  .addIntentMatcherNode('intents', { ... })
  .addGoalAdvancementNode('goals', { ... })
```

## Best Practices

1. **Start Simple**: Begin with 2-3 goals and expand as needed
2. **Clear Motivations**: Write clear motivation strings to help the LLM understand context
3. **Specific Detection**: Use concrete detection conditions for better accuracy
4. **Maintain History**: Include relevant event history for context
5. **Update Belief State**: Use belief state to track conversation facts
6. **Test Dependencies**: Verify goal dependencies create the desired flow
7. **Monitor Performance**: Use the `text_generation_config` to tune LLM behavior

## Advanced Usage

### Dynamic Goal Override

Override goals at runtime based on user context:

```typescript
const request = new GraphTypes.GoalAdvancementRequest({
  // ... other fields
  goals_for_evaluation_override: [
    // Different goals for VIP users
    { name: 'vip_greeting', ... }
  ]
});
```

### Belief State Management

Track conversation facts across goals:

```typescript
// After each goal advancement, update belief state
const updatedState = {
  ...previousState,
  user_age: extractedAge,
  goals_completed: response.completedGoals.length
};
```

### Multi-Agent Goals

Use different agent_info for different conversational contexts:

```typescript
const request = new GraphTypes.GoalAdvancementRequest({
  agent_info: {
    name: 'SalesBot',
    description: 'A sales assistant focused on helping customers find products'
  },
  // ... other fields
});
```

## Troubleshooting

### Goals Not Activating

- Check `required_goals` are completed
- Verify LLM has sufficient context in `event_history`
- Review `activation_condition.detect` is clear and specific

### Goals Not Completing

- Ensure `completion_condition.detect` matches actual user input
- Check if `text_generation_config.temperature` is too high/low
- Verify belief state contains relevant information

### Unexpected Goal Order

- Review goal dependencies (`required_goals`)
- Check for conflicting activation conditions
- Verify `repeatable` flag is set correctly

## See Also

- [Intent Matching Templates](../retrieval/) - Combine with intent detection
- [LLM Chat Templates](../llm/) - Generate responses based on active goals
- [Transform Node Templates](../text_processing/) - Extract goal information

