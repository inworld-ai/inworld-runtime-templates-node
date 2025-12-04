import { CustomNode, GraphTypes, ProcessContext } from '@inworld/runtime/graph';

interface LLMStrategy {
  id: string;
  priority: number;
  provider: string;
  modelName: string;
  errorCooldownPeriod?: number; // Seconds to wait after error before retrying this LLM
  minErrorsToDisable?: number; // Number of consecutive errors before disabling this LLM
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

// Module-level error tracking registry
const errorRegistry = new Map<string, ErrorTracking>();

/**
 * LLM Router node that manages priority-based LLM selection with fallback support.
 *
 * This custom node routes requests to LLMs based on priority order. On initial call,
 * it selects the highest priority LLM. When looped back after a failure, it selects
 * the next LLM in priority order.
 *
 * The node maintains routing state including:
 * - Current strategy index
 * - Attempt count
 * - Failed strategies list
 * - Original request
 *
 * @example
 * ```typescript
 * // Define strategies with priorities
 * const strategies: LLMStrategy[] = [
 *   { id: 'primary', priority: 300, provider: 'anthropic', modelName: 'claude-3' },
 *   { id: 'fallback', priority: 200, provider: 'openai', modelName: 'gpt-4' }
 * ];
 *
 * // Create router node
 * const routerNode = new LLMRouterCustomNode(strategies);
 *
 * // Use in graph with executor and loop edge for retry
 * ```
 */
export class LLMRouterCustomNode extends CustomNode {
  constructor(private strategies: LLMStrategy[]) {
    super({ id: 'llm_router' });
  }

  /**
   * Check if a strategy is currently in cooldown period
   */
  private isInCooldown(strategy: LLMStrategy): boolean {
    const tracking = errorRegistry.get(strategy.id);
    if (!tracking || !strategy.errorCooldownPeriod) {
      return false;
    }

    const timeSinceError =
      (Date.now() - tracking.lastErrorTime.getTime()) / 1000;
    return timeSinceError < strategy.errorCooldownPeriod;
  }

  /**
   * Check if a strategy is disabled due to excessive errors
   */
  private isDisabled(strategy: LLMStrategy): boolean {
    const tracking = errorRegistry.get(strategy.id);
    return tracking?.disabled || false;
  }

  process(
    _context: ProcessContext,
    input: GraphTypes.LLMChatRequest | LLMRoutingState,
    ...otherInputs: any[]
  ): LLMRoutingState {
    // Check if we have a state in the second input (from loop edge)
    const stateInput =
      otherInputs.length > 0 && 'currentStrategyIndex' in otherInputs[0]
        ? otherInputs[0]
        : 'currentStrategyIndex' in input
          ? input
          : null;

    let state: LLMRoutingState;

    // Initialize or continue from previous state
    if (stateInput) {
      // This is a retry - increment to next strategy
      const prevState = stateInput as LLMRoutingState;

      state = {
        ...prevState,
        currentStrategyIndex: prevState.currentStrategyIndex + 1,
        attemptCount: prevState.attemptCount + 1,
      };
    } else {
      // First attempt - initialize state
      state = {
        originalRequest: input as GraphTypes.LLMChatRequest,
        currentStrategyIndex: 0,
        attemptCount: 1,
        failedStrategies: [],
        success: false,
      };
    }

    const sortedStrategies = [...this.strategies].sort(
      (a, b) => b.priority - a.priority,
    );

    // Find next available strategy (not in cooldown or disabled)
    let currentIndex = state.currentStrategyIndex;
    while (currentIndex < sortedStrategies.length) {
      const strategy = sortedStrategies[currentIndex];

      // Skip if disabled
      if (this.isDisabled(strategy)) {
        currentIndex++;
        continue;
      }

      // Skip if in cooldown
      if (this.isInCooldown(strategy)) {
        currentIndex++;
        continue;
      }

      // Found available strategy
      return {
        ...state,
        currentStrategyIndex: currentIndex,
      };
    }

    // No available strategies found
    return {
      ...state,
      currentStrategyIndex: currentIndex,
      success: false,
      error: 'No available LLM strategies (all disabled or in cooldown)',
    };
  }
}
