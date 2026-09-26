import type { CallExpression, Decorator } from 'ts-morph';
import type { BehaviorEvent, SourceLocation } from '../types/index.js';

export interface ASTContext {
  filePath: string;
  relativeFilePath: string;
  enclosingClass?: string;
  enclosingFunction?: string;
  isAwaited: boolean;
  isConditional: boolean;
  isGuardedByTryCatch: boolean;
  injectedDependencies: string[];
}

export interface FrameworkAdapter {
  readonly name: string;
  readonly order: number; // Lower number means higher priority

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null;
  classifyDecorator?(decorator: Decorator, context: ASTContext): BehaviorEvent | null;
}

export function createLocation(filePath: string, node: { getStartLineNumber(): number; getEndLineNumber(): number; getStart(): number; getEnd(): number; getSourceFile(): any }): SourceLocation {
  const sf = node.getSourceFile();
  const startPos = sf.getLineAndColumnAtPos(node.getStart());
  const endPos = sf.getLineAndColumnAtPos(node.getEnd());
  return {
    filePath,
    startLine: startPos.line,
    startColumn: startPos.column,
    endLine: endPos.line,
    endColumn: endPos.column,
  };
}
