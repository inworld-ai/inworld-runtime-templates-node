import { CustomNode, GraphTypes, ProcessContext } from '@inworld/runtime/graph';

interface LLMStrategy {
  id: string;
  priority: number;
  provider: string;
  modelName: string;
  errorCooldownPeriod?: number;
  minErrorsToDisable?: number;
}

interface LLMRoutingState {
  originalRequest: GraphTypes.LLMChatRequest;
  currentStrategyIndex: number;
  attemptCount: number;
  failedStrategies: string[];
  result?: string;
  success: boolean;
  error?: string;
}

interface ErrorTracking {
  consecutiveErrors: number;
  lastErrorTime: Date;
  disabled: boolean;
}

// Module-level error tracking registry (shared with router)
const errorRegistry = new Map<string, ErrorTracking>();

/**
 * LLM Executor node that executes LLM requests and streams responses.
 *
 * This custom node retrieves an LLM interface based on the current routing state,
 * executes the request, and streams the response to stdout. It handles both
 * successful executions and failures, updating the routing state accordingly.
 *
 * On success, the node sets success=true and includes the result text.
 * On failure, it adds the failed strategy to the list and sets success=false
 * to trigger fallback routing.
 *
 * @example
 * ```typescript
 * // Create executor node with strategies
 * const executorNode = new LLMExecutorCustomNode(strategies);
 *
 * // Use in graph after router
 * const graph = builder
 *   .addEdge(routerNode, executorNode)
 *   .addEdge(executorNode, routerNode, {
 *     conditionExpression: '!input.value.success',
 *     loop: true
 *   });
 * ```
 */
export class LLMExecutorCustomNode extends CustomNode {
  constructor(private strategies: LLMStrategy[]) {
    super({ id: 'llm_executor' });
  }

  /**
   * Register an error for a strategy
   */
  private registerError(strategy: LLMStrategy): void {
    const tracking = errorRegistry.get(strategy.id) || {
      consecutiveErrors: 0,
      lastErrorTime: new Date(),
      disabled: false,
    };

    tracking.consecutiveErrors++;
    tracking.lastErrorTime = new Date();

    // Check if should disable based on minErrorsToDisable
    if (
      strategy.minErrorsToDisable &&
      tracking.consecutiveErrors >= strategy.minErrorsToDisable
    ) {
      tracking.disabled = true;
    }

    errorRegistry.set(strategy.id, tracking);
  }

  /**
   * Reset error tracking on success
   */
  private resetErrors(strategy: LLMStrategy): void {
    const tracking = errorRegistry.get(strategy.id);
    if (tracking) {
      tracking.consecutiveErrors = 0;
      errorRegistry.set(strategy.id, tracking);
    }
  }

  async process(
    context: ProcessContext,
    state: LLMRoutingState,
  ): Promise<LLMRoutingState> {
    const sortedStrategies = [...this.strategies].sort(
      (a, b) => b.priority - a.priority,
    );
    const currentStrategy = sortedStrategies[state.currentStrategyIndex];

    if (!currentStrategy) {
      return {
        ...state,
        success: false,
        error: 'No strategy available',
      };
    }

    try {
      const llm = context.getLLMInterface(currentStrategy.id);

      const requestWithConfig = new GraphTypes.LLMChatRequest({
        messages: state.originalRequest.messages,
      });

      const contentStream = await llm.generateContent(requestWithConfig);

      let result = '';

      for await (const chunk of contentStream) {
        if (chunk.text) {
          result += chunk.text;
          process.stdout.write(chunk.text);
        }
      }

      process.stdout.write('\n');

      // Reset error tracking on success
      this.resetErrors(currentStrategy);

      return {
        ...state,
        result,
        success: true,
      };
    } catch (error: any) {
      // Log error for debugging
      console.error(
        `\nLLM Execution Error [${currentStrategy.id}]: ${error.message}`,
      );

      // Register error for this strategy
      this.registerError(currentStrategy);

      return {
        ...state,
        failedStrategies: [...state.failedStrategies, currentStrategy.id],
        success: false,
        error: error.message,
      };
    }
  }
}
