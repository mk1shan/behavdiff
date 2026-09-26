import type { CallExpression, Decorator } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class NestJsAdapter implements FrameworkAdapter {
  readonly name = 'nestjs';
  readonly order = 15;

  classifyCall(_call: CallExpression, _context: ASTContext): BehaviorEvent | null {
    return null;
  }

  classifyDecorator(decorator: Decorator, context: ASTContext): BehaviorEvent | null {
    const text = decorator.getText();

    if (text.includes('UseGuards') || text.includes('AuthGuard')) {
      return {
        id: `nestjs-auth-${decorator.getStart()}`,
        type: 'AUTH',
        label: text,
        location: createLocation(context.filePath, decorator),
        isAwaited: false,
        isConditional: false,
        isGuardedByTryCatch: false,
        adapterSource: this.name,
        rawCallee: text,
      };
    }

    if (text.includes('UsePipes') || text.includes('ValidationPipe')) {
      return {
        id: `nestjs-val-${decorator.getStart()}`,
        type: 'VALIDATION',
        label: text,
        location: createLocation(context.filePath, decorator),
        isAwaited: false,
        isConditional: false,
        isGuardedByTryCatch: false,
        adapterSource: this.name,
        rawCallee: text,
      };
    }

    return null;
  }
}
