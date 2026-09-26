import type { CallExpression } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

export class ExpressAdapter implements FrameworkAdapter {
  readonly name = 'express';
  readonly order = 50;

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // res.status(...).json(...) or res.send(...)
    if (
      exprText.match(/(?:res|response)\.(?:json|send|status|sendStatus)$/)
    ) {
      // In Express, res.send is a response completion event rather than external drift,
      // but if needed can be classified or ignored.
      return null;
    }

    return null;
  }
}
