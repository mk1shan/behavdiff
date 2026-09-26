import type { CallExpression, Decorator } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext } from './types.js';
import { PrismaAdapter } from './prisma.js';
import { NestJsAdapter } from './nestjs.js';
import { ValidationAdapter } from './validation.js';
import { EmailAdapter } from './email.js';
import { HttpAdapter } from './http.js';
import { ExpressAdapter } from './express.js';
import { GenericTypeScriptAdapter } from './generic-typescript.js';

export class AdapterRegistry {
  private adapters: FrameworkAdapter[] = [];

  constructor() {
    this.register(new PrismaAdapter());
    this.register(new NestJsAdapter());
    this.register(new ValidationAdapter());
    this.register(new EmailAdapter());
    this.register(new HttpAdapter());
    this.register(new ExpressAdapter());
    this.register(new GenericTypeScriptAdapter());
  }

  register(adapter: FrameworkAdapter): void {
    this.adapters.push(adapter);
    this.adapters.sort((a, b) => a.order - b.order);
  }

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    for (const adapter of this.adapters) {
      const event = adapter.classifyCall(call, context);
      if (event) {
        return event;
      }
    }
    return null;
  }

  classifyDecorator(decorator: Decorator, context: ASTContext): BehaviorEvent | null {
    for (const adapter of this.adapters) {
      if (adapter.classifyDecorator) {
        const event = adapter.classifyDecorator(decorator, context);
        if (event) {
          return event;
        }
      }
    }
    return null;
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
