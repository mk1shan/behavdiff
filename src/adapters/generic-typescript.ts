import type { CallExpression } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class GenericTypeScriptAdapter implements FrameworkAdapter {
  readonly name = 'generic-typescript';
  readonly order = 100; // Evaluated after framework-specific adapters

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // 1. Payment detection
    if (exprText.match(/(?:this\.)?(?:stripe|paypal|braintree|square|razorpay)\./i)) {
      return {
        id: `payment-${call.getStart()}`,
        type: 'PAYMENT',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 2. Queue detection
    if (
      exprText.match(/(?:this\.)?(?:queue|kafka|rabbit|channel|sqs)\.(?:add|send|publish|emit|enqueue)/i)
    ) {
      return {
        id: `queue-${call.getStart()}`,
        type: 'QUEUE',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 3. Cache detection
    if (exprText.match(/(?:this\.)?(?:cache|redis|memcached)\.(?:get|hget|mget)/i)) {
      return {
        id: `cache-read-${call.getStart()}`,
        type: 'CACHE_READ',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }
    if (exprText.match(/(?:this\.)?(?:cache|redis|memcached)\.(?:set|setex|del|hset)/i)) {
      return {
        id: `cache-write-${call.getStart()}`,
        type: 'CACHE_WRITE',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 4. External service call fallback
    if (exprText.match(/(?:this\.)?(?:[a-zA-Z0-9_]*external[a-zA-Z0-9_]*|client|api)\.[a-zA-Z0-9_]+$/i)) {
      return {
        id: `ext-effect-${call.getStart()}`,
        type: 'UNKNOWN_EXTERNAL_EFFECT',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    return null;
  }
}
