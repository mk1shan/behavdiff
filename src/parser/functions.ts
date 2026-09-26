import {
  SourceFile,
  FunctionDeclaration,
  MethodDeclaration,
  ArrowFunction,
  FunctionExpression,
  VariableDeclaration,
  ClassDeclaration,
  SyntaxKind,
  Node,
} from 'ts-morph';
import path from 'node:path';
import type {
  FrameworkRole,
  ParameterInfo,
  SourceLocation,
} from '../types/index.js';
import { createLocation } from '../adapters/types.js';

export interface ExtractedFunctionNode {
  name: string;
  enclosingClass?: string;
  role: FrameworkRole;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  routePath?: string;
  parameters: ParameterInfo[];
  returnTypeText?: string;
  decorators: string[];
  injectedDependencies: string[];
  location: SourceLocation;
  node: FunctionDeclaration | MethodDeclaration | ArrowFunction | FunctionExpression;
  sourceFile: SourceFile;
}

export function extractFunctionsFromSourceFile(
  sourceFile: SourceFile,
  rootDir: string,
): ExtractedFunctionNode[] {
  const extracted: ExtractedFunctionNode[] = [];
  const filePath = sourceFile.getFilePath();

  // 1. Process Class Methods
  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName() || 'AnonymousClass';
    const isNestController = cls.getDecorators().some((d) => d.getName() === 'Controller');
    const isNestInjectable = cls.getDecorators().some((d) => d.getName() === 'Injectable');
    const looksLikeController =
      className.toLowerCase().endsWith('controller') ||
      path.basename(filePath).toLowerCase().includes('.controller.');

    // Extract constructor injected dependencies
    const injectedDependencies: string[] = [];
    const constructor = cls.getConstructors()[0];
    if (constructor) {
      for (const param of constructor.getParameters()) {
        injectedDependencies.push(param.getName());
      }
    }

    for (const method of cls.getMethods()) {
      const methodName = method.getName();
      // Skip constructors and getters/setters if treated as methods
      if (!methodName || methodName === 'constructor') continue;

      const decorators = method.getDecorators().map((d) => d.getText());
      let role: FrameworkRole = 'generic-service-method';
      let httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined;
      let routePath: string | undefined;

      if (isNestController) {
        role = 'nestjs-controller-method';
      } else if (looksLikeController) {
        role = 'generic-controller-method';
      } else if (isNestInjectable || className.endsWith('Service')) {
        role = 'nestjs-service-method';
      }

      // Check HTTP method decorators
      for (const d of method.getDecorators()) {
        const dName = d.getName();
        if (['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(dName)) {
          httpMethod = dName.toUpperCase() as any;
          role = 'nestjs-controller-method';
          const args = d.getArguments();
          if (args.length > 0) {
            routePath = args[0].getText().replace(/['"]/g, '');
          }
        }
      }

      const parameters: ParameterInfo[] = method.getParameters().map((p) => {
        const typeText = p.getTypeNode()?.getText();
        const isDtoLike = !!typeText && (typeText.endsWith('Dto') || typeText.endsWith('Input') || typeText.endsWith('Request'));
        return {
          name: p.getName(),
          typeText,
          isDtoLike,
        };
      });

      const returnTypeText = method.getReturnTypeNode()?.getText();

      extracted.push({
        name: methodName,
        enclosingClass: className,
        role,
        httpMethod,
        routePath,
        parameters,
        returnTypeText,
        decorators,
        injectedDependencies,
        location: createLocation(filePath, method),
        node: method,
        sourceFile,
      });
    }
  }

  // 2. Process Standalone Functions
  for (const fn of sourceFile.getFunctions()) {
    const fnName = fn.getName();
    if (!fnName) continue;

    const parameters: ParameterInfo[] = fn.getParameters().map((p) => ({
      name: p.getName(),
      typeText: p.getTypeNode()?.getText(),
      isDtoLike: false,
    }));

    extracted.push({
      name: fnName,
      role: 'standalone-function',
      parameters,
      returnTypeText: fn.getReturnTypeNode()?.getText(),
      decorators: [],
      injectedDependencies: [],
      location: createLocation(filePath, fn),
      node: fn,
      sourceFile,
    });
  }

  // 3. Process Arrow Functions assigned to const/let/var
  for (const varStmt of sourceFile.getVariableStatements()) {
    for (const decl of varStmt.getDeclarationList().getDeclarations()) {
      const init = decl.getInitializer();
      if (!init) continue;

      if (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) {
        const fnName = decl.getName();
        let role: FrameworkRole = 'standalone-function';
        let httpMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined;

        // Check if looks like Express route: (req, res, next)
        const params = init.getParameters();
        const paramNames = params.map((p) => p.getName());
        if (paramNames.includes('req') && paramNames.includes('res')) {
          role = 'express-route-handler';
        }

        extracted.push({
          name: fnName,
          role,
          httpMethod,
          parameters: params.map((p) => ({
            name: p.getName(),
            typeText: p.getTypeNode()?.getText(),
            isDtoLike: false,
          })),
          returnTypeText: init.getReturnTypeNode()?.getText(),
          decorators: [],
          injectedDependencies: [],
          location: createLocation(filePath, init),
          node: init,
          sourceFile,
        });
      }
    }
  }

  return extracted;
}
