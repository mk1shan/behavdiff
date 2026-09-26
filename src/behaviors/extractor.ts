import {
  Node,
  SyntaxKind,
  CallExpression,
  MethodDeclaration,
  FunctionDeclaration,
  ArrowFunction,
  FunctionExpression,
} from 'ts-morph';
import path from 'node:path';
import type {
  BehaviorEvent,
  BehaviorType,
  FunctionFingerprint,
  UnknownCall,
} from '../types/index.js';
import { ExtractedFunctionNode } from '../parser/functions.js';
import { defaultAdapterRegistry, AdapterRegistry } from '../adapters/registry.js';
import { ASTContext, createLocation } from '../adapters/types.js';
import { CustomBehaviorMappings, matchCustomBehavior } from '../config.js';

export class BehaviorExtractor {
  constructor(
    private adapterRegistry: AdapterRegistry = defaultAdapterRegistry,
    private customBehaviorMappings: CustomBehaviorMappings = {},
  ) {}

  extractFingerprint(
    extractedFn: ExtractedFunctionNode,
    rootDir: string,
  ): FunctionFingerprint {
    const filePath = extractedFn.location.filePath;
    const relativeFilePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const behaviors: BehaviorEvent[] = [];
    const unknownCalls: UnknownCall[] = [];
    const targetEntitiesSet = new Set<string>();

    const baseContext: ASTContext = {
      filePath,
      relativeFilePath,
      enclosingClass: extractedFn.enclosingClass,
      enclosingFunction: extractedFn.name,
      isAwaited: false,
      isConditional: false,
      isGuardedByTryCatch: false,
      injectedDependencies: extractedFn.injectedDependencies,
    };

    // 1. Classify method decorators (e.g. @UseGuards -> AUTH, @UsePipes -> VALIDATION)
    if (Node.isMethodDeclaration(extractedFn.node)) {
      for (const dec of extractedFn.node.getDecorators()) {
        const event = this.adapterRegistry.classifyDecorator(dec, baseContext);
        if (event) {
          behaviors.push(event);
        }
      }
    }

    // 2. Traverse statements in function body
    const body = extractedFn.node.getBody();
    if (body) {
      this.walkNode(body, baseContext, behaviors, unknownCalls, targetEntitiesSet, new Set());
    }

    const sequence: BehaviorType[] = behaviors.map((b) => b.type);
    const targetEntities = Array.from(targetEntitiesSet);

    const id = `${relativeFilePath}::${extractedFn.enclosingClass || 'global'}::${extractedFn.name}::${extractedFn.location.startLine}`;

    return {
      id,
      name: extractedFn.name,
      filePath,
      relativeFilePath,
      enclosingClassOrObject: extractedFn.enclosingClass,
      role: extractedFn.role,
      httpMethod: extractedFn.httpMethod,
      routePath: extractedFn.routePath,
      parameters: extractedFn.parameters,
      returnTypeText: extractedFn.returnTypeText,
      decorators: extractedFn.decorators,
      injectedDependencies: extractedFn.injectedDependencies,
      targetEntities,
      behaviors,
      sequence,
      unknownCalls,
      location: extractedFn.location,
    };
  }

  private walkNode(
    node: Node,
    context: ASTContext,
    behaviors: BehaviorEvent[],
    unknownCalls: UnknownCall[],
    targetEntitiesSet: Set<string>,
    expandedFunctions: Set<string>,
  ): void {
    const kind = node.getKind();

    // Check if entering a try block
    let isGuardedByTryCatch = context.isGuardedByTryCatch;
    if (kind === SyntaxKind.TryStatement) {
      const tryStmt = node.asKindOrThrow(SyntaxKind.TryStatement);
      const tryBlock = tryStmt.getTryBlock();
      this.walkNode(
        tryBlock,
        { ...context, isGuardedByTryCatch: true },
        behaviors,
        unknownCalls,
        targetEntitiesSet,
        expandedFunctions,
      );

      const catchClause = tryStmt.getCatchClause();
      if (catchClause) {
        this.walkNode(
          catchClause.getBlock(),
          { ...context, isGuardedByTryCatch: false },
          behaviors,
          unknownCalls,
          targetEntitiesSet,
          expandedFunctions,
        );
      }

      const finallyBlock = tryStmt.getFinallyBlock();
      if (finallyBlock) {
        this.walkNode(
          finallyBlock,
          { ...context, isGuardedByTryCatch: false },
          behaviors,
          unknownCalls,
          targetEntitiesSet,
          expandedFunctions,
        );
      }
      return;
    }

    // Check if entering a conditional statement
    let isConditional = context.isConditional;
    if (
      kind === SyntaxKind.IfStatement ||
      kind === SyntaxKind.ConditionalExpression ||
      kind === SyntaxKind.SwitchStatement ||
      kind === SyntaxKind.CaseClause
    ) {
      isConditional = true;
    }

    // If this node is a CallExpression
    if (Node.isCallExpression(node)) {
      const parent = node.getParent();
      const isAwaited = parent ? Node.isAwaitExpression(parent) : false;

      const callContext: ASTContext = {
        ...context,
        isAwaited,
        isConditional,
      };

      const callee = node.getExpression().getText().replace(/\s+/g, '');
      const configuredBehavior = matchCustomBehavior(callee, this.customBehaviorMappings);
      const event = configuredBehavior
        ? this.createConfiguredEvent(node, callContext, configuredBehavior, callee)
        : this.adapterRegistry.classifyCall(node, callContext);
      if (event) {
        behaviors.push(event);
        if (event.payload?.entity && typeof event.payload.entity === 'string') {
          targetEntitiesSet.add(event.payload.entity);
        }
      } else {
        const behaviorCountBeforeExpansion = behaviors.length;
        const calledFunction = this.resolveCalledFunction(node);
        const calledBody = calledFunction?.getBody();
        if (calledFunction && calledBody) {
          const declarationId = `${calledFunction.getSourceFile().getFilePath()}:${calledFunction.getStart()}`;
          if (!expandedFunctions.has(declarationId)) {
            expandedFunctions.add(declarationId);
            this.walkNode(
              calledBody,
              { ...callContext, filePath: calledFunction.getSourceFile().getFilePath() },
              behaviors,
              unknownCalls,
              targetEntitiesSet,
              expandedFunctions,
            );
          }
        }
        if (
          this.isInjectedDependencyCall(callee, callContext.injectedDependencies) &&
          behaviors.length === behaviorCountBeforeExpansion
        ) {
          unknownCalls.push({ callee, location: createLocation(context.filePath, node) });
        }
      }
    }

    // Recurse into children
    node.forEachChild((child) => {
      this.walkNode(
        child,
        { ...context, isConditional, isGuardedByTryCatch },
        behaviors,
        unknownCalls,
        targetEntitiesSet,
        expandedFunctions,
      );
    });
  }

  private createConfiguredEvent(
    call: CallExpression,
    context: ASTContext,
    behavior: BehaviorType,
    callee: string,
  ): BehaviorEvent {
    return {
      id: `custom-${call.getStart()}`,
      type: behavior,
      label: callee,
      location: createLocation(context.filePath, call),
      isAwaited: context.isAwaited,
      isConditional: context.isConditional,
      isGuardedByTryCatch: context.isGuardedByTryCatch,
      adapterSource: 'project-config',
      rawCallee: callee,
    };
  }

  private isInjectedDependencyCall(callee: string, dependencies: string[]): boolean {
    // A chained call such as service.request().then(...).catch(...) is one
    // operation; do not report each promise-chain wrapper as a separate API.
    if (callee.includes('(')) return false;
    return dependencies.some((dependency) =>
      callee.startsWith(`this.${dependency}.`) || callee.startsWith(`${dependency}.`),
    );
  }

  private resolveCalledFunction(
    call: CallExpression,
  ): FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression | undefined {
    let symbol = call.getExpression().getSymbol();
    if (!symbol) return undefined;

    if (symbol.isAlias()) {
      symbol = symbol.getAliasedSymbol() ?? symbol;
    }

    for (const declaration of symbol.getDeclarations()) {
      if (
        Node.isFunctionDeclaration(declaration) ||
        Node.isMethodDeclaration(declaration) ||
        Node.isArrowFunction(declaration) ||
        Node.isFunctionExpression(declaration)
      ) {
        return declaration;
      }

      if (Node.isVariableDeclaration(declaration)) {
        const initializer = declaration.getInitializer();
        if (initializer && (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer))) {
          return initializer;
        }
      }
    }

    return undefined;
  }
}
