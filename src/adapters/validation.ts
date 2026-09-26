import type { CallExpression, Decorator } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class ValidationAdapter implements FrameworkAdapter {
  readonly name = 'validation';
  readonly order = 20;

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // 1. Zod: *.parse(...), *.safeParse(...)
    if (exprText.endsWith('.parse') || exprText.endsWith('.safeParse')) {
      return {
        id: `validation-zod-${call.getStart()}`,
        type: 'VALIDATION',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 2. Class-validator: validate(...), validateOrReject(...)
    if (
      exprText === 'validate' ||
      exprText === 'validateOrReject' ||
      exprText.endsWith('.validate') ||
      exprText.endsWith('.validateOrReject')
    ) {
      return {
        id: `validation-cv-${call.getStart()}`,
        type: 'VALIDATION',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 3. Joi / Yup: *.validate(...)
    if (exprText.endsWith('.validate') || exprText.endsWith('.validateAsync')) {
      return {
        id: `validation-schema-${call.getStart()}`,
        type: 'VALIDATION',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // 4. In-code validation methods: validateX(), this.validateX(), assertX(), checkX()
    const methodMatch = exprText.match(/(?:this\.)?(validate[A-Z0-9_]\w*|assert[A-Z0-9_]\w*|check[A-Z0-9_]\w*)$/i);
    if (methodMatch) {
      return {
        id: `validation-fn-${call.getStart()}`,
        type: 'VALIDATION',
        label: methodMatch[1],
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

  classifyDecorator(decorator: Decorator, context: ASTContext): BehaviorEvent | null {
    const text = decorator.getText();
    if (text.includes('ValidationPipe') || text.includes('UsePipes')) {
      return {
        id: `validation-dec-${decorator.getStart()}`,
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
