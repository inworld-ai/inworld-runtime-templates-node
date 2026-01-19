# Error Handling Templates

This directory contains templates demonstrating the comprehensive error handling capabilities of the Inworld Runtime Framework. These templates show how to build resilient systems with automatic retry logic, fallback routing, and circuit breaker patterns.

## Overview

The error handling system provides three layers of protection:

1. **Retries** (Non-stateful) - Immediate retry attempts within a single execution
2. **Fallbacks** (Stateful) - Route to alternative nodes when primary fails
3. **Circuit Breaker** (Cooldown) - Prevent repeated attempts on persistently failing nodes

## Templates

### 1. Basic Retry (`basic_retry.ts`)

Demonstrates simple retry configuration for automatic retry on transient errors.

```bash
# Run with default settings
npm run error-handling-basic-retry "Complete this: The sky is"

# Test retry with invalid model (demonstrates retry behavior)
npm run error-handling-basic-retry "Test" -- --modelName="invalid-model"
```

**Key Features:**
- Retry up to 3 times on UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL errors
- Non-retryable errors (INVALID_ARGUMENT, NOT_FOUND, etc.) fail immediately
- Retries happen within a single execution

**Configuration Example:**
```typescript
import { ErrorStatusCode } from '@inworld/runtime/graph';

errorHandling: {
  retries: [
    {
      maxAttempts: 3,
      handleErrors: [
        ErrorStatusCode.Unavailable,
        ErrorStatusCode.DeadlineExceeded,
        ErrorStatusCode.Internal,
      ],
    },
  ],
}
```

### 2. Fallback Routing (`fallback_routing.ts`)

Shows how to configure fallback nodes for automatic routing when primary node fails.

```bash
# Run with default settings
npm run error-handling-fallback "Tell me a joke"

# Test fallback by using invalid model
npm run error-handling-fallback "Test" -- --modelName="invalid-model"
```

**Key Features:**
- Primary node fails → automatically routes to fallback node
- Fallbacks are stateful and persist across executions
- Error-specific fallback routing based on error codes
- Results returned under primary node ID for transparency

**Configuration Example:**
```typescript
import { ErrorStatusCode } from '@inworld/runtime/graph';

errorHandling: {
  fallbacks: [
    {
      nodeId: 'fallback_completion',
      handleErrors: [
        ErrorStatusCode.Unavailable,
        ErrorStatusCode.Internal,
        ErrorStatusCode.DeadlineExceeded,
      ],
    },
  ],
}
```

### 3. Circuit Breaker / Cooldown (`circuit_breaker_cooldown.ts`)

Demonstrates the circuit breaker pattern to prevent cascading failures.

```bash
# Run normally (success case)
npm run error-handling-circuit-breaker "Tell me about AI"
```

**Key Features:**
- Circuit breaker opens after N consecutive failures
- Node is skipped during cooldown period
- Automatic recovery with "half-open" state for testing
- Success resets the circuit breaker

**Circuit Breaker States:**
- **CLOSED** (Normal): Node executes normally
- **OPEN** (Cooldown): Node is skipped, routes to fallback if available
- **HALF-OPEN** (Testing): After cooldown expires, one attempt is allowed
  - Success → reset to CLOSED
  - Failure → back to OPEN

**Configuration Example:**
```typescript
import { ErrorStatusCode } from '@inworld/runtime/graph';

errorHandling: {
  cooldown: {
    minConsecutiveFailures: 2,
    cooldownDuration: '10s', // String format: '10s', '1m', '500ms', '2h'
  },
  fallbacks: [
    {
      nodeId: 'fallback_completion',
      handleErrors: [
        ErrorStatusCode.Unavailable,
        ErrorStatusCode.Internal,
        ErrorStatusCode.DeadlineExceeded,
      ],
    },
  ],
}
```

### 4. Advanced Combined (`advanced_combined.ts`)

Comprehensive example combining all error handling features.

```bash
# Complete error handling demonstration
npm run error-handling-advanced "What is resilient system design?"

# Test error handling chain
npm run error-handling-advanced "Test" -- --modelName="invalid-model"
```

**Key Features:**
- Multiple retry strategies for different error types
- Ordered fallback chain with priority
- Per-fallback cooldown customization
- Circuit breaker prevents cascading failures
- Stateful health tracking across executions

**3-Tier Error Handling Flow:**

1. **RETRIES**: First line of defense
   - Node fails → retry up to max_attempts
   - Different retry strategies per error type

2. **FALLBACKS**: Second line of defense
   - All retries exhausted → route to fallback node
   - Fallback nodes can have their own error handling
   - Multiple fallbacks in priority order

3. **CIRCUIT BREAKER**: Long-term protection
   - Track consecutive failures across executions
   - After N failures → enter cooldown
   - Skip node during cooldown, use fallback directly

**Configuration Example:**
```typescript
import { ErrorStatusCode } from '@inworld/runtime/graph';

errorHandling: {
  // Multiple retry strategies
  retries: [
    {
      maxAttempts: 2,
      handleErrors: [ErrorStatusCode.Unavailable],
    },
    {
      maxAttempts: 3,
      handleErrors: [ErrorStatusCode.DeadlineExceeded],
    },
  ],
  // Ordered fallback chain
  fallbacks: [
    {
      nodeId: 'primary_fallback',
      handleErrors: [ErrorStatusCode.Unavailable, ErrorStatusCode.Internal],
      // Per-fallback cooldown override
      cooldown: {
        minConsecutiveFailures: 3,
        cooldownDuration: '20s', // String format with unit
      },
    },
    {
      nodeId: 'secondary_fallback',
      handleErrors: [], // Catch-all
    },
  ],
  // Common circuit breaker
  cooldown: {
    minConsecutiveFailures: 2,
    cooldownDuration: 30000, // Number format in milliseconds (30s)
  },
}
```

## Duration Format

The `cooldownDuration` field accepts flexible input formats:

**String format with units:**
- `'500ms'` - milliseconds
- `'10s'` - seconds  
- `'5m'` - minutes
- `'2h'` - hours

**Number format (milliseconds):**
- `500` - 500 milliseconds
- `10000` - 10 seconds (10,000ms)
- `300000` - 5 minutes (300,000ms)
- `7200000` - 2 hours (7,200,000ms)

Both formats are equivalent and will be normalized internally. Choose the format that's most readable for your use case.

## Error Codes

All error codes are available through the `ErrorStatusCode` enum from `@inworld/runtime/graph`.

### Retryable Errors (Default)
- `ErrorStatusCode.Unavailable` - Service temporarily unavailable
- `ErrorStatusCode.DeadlineExceeded` - Request timeout
- `ErrorStatusCode.Internal` - Internal server error
- `ErrorStatusCode.ResourceExhausted` - Rate limit or quota exceeded
- `ErrorStatusCode.Unknown` - Unknown error
- `ErrorStatusCode.Aborted` - Operation aborted
- `ErrorStatusCode.DataLoss` - Data loss or corruption

### Non-Retryable Errors (Default)
- `ErrorStatusCode.InvalidArgument` - Invalid request parameters
- `ErrorStatusCode.NotFound` - Resource not found
- `ErrorStatusCode.PermissionDenied` - Insufficient permissions
- `ErrorStatusCode.Unauthenticated` - Authentication required
- `ErrorStatusCode.FailedPrecondition` - Precondition not met
- `ErrorStatusCode.OutOfRange` - Value out of range

## Error Handling Best Practices

1. **Retry Configuration**
   - Use retries for transient errors (network issues, temporary unavailability)
   - Set appropriate max_attempts to balance reliability and latency
   - Don't retry non-idempotent operations without careful consideration

2. **Fallback Strategy**
   - Order fallbacks by priority (most preferred first)
   - Use specific error matching for targeted fallback routing
   - Consider cost/performance trade-offs between primary and fallback nodes
   - Each fallback can have its own error handling configuration

3. **Circuit Breaker**
   - Set minConsecutiveFailures based on expected error rates
   - Choose cooldownDuration appropriate for your use case (supports '10s', '1m', or milliseconds)
   - Use per-fallback cooldowns for fine-grained control
   - Monitor circuit breaker states in production

4. **Combined Strategy**
   - Layer error handling: retries → fallbacks → circuit breaker
   - Use retries for immediate recovery
   - Use fallbacks for alternative implementations
   - Use circuit breaker to prevent cascading failures
   - Test the complete error path, not just the happy path

## Monitoring and Observability

The error handling system integrates with the telemetry framework:
- Track retry attempts and success rates
- Monitor fallback activation frequency
- Alert on circuit breaker state transitions
- Measure error recovery times

See the observability templates for telemetry examples.
