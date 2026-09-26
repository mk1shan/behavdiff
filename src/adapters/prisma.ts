import type { CallExpression } from 'ts-morph';
import type { BehaviorEvent } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

const DB_READ_METHODS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const DB_WRITE_METHODS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

export class PrismaAdapter implements FrameworkAdapter {
  readonly name = 'prisma';
  readonly order = 10; // High priority before generic adapters

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const exprText = call.getExpression().getText();

    // Direct transaction check: prisma.$transaction, this.prisma.$transaction
    if (exprText.includes('$transaction')) {
      return {
        id: `prisma-tx-${call.getStart()}`,
        type: 'TRANSACTION_BEGIN',
        label: exprText,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
      };
    }

    // Pattern: [this.]prisma.<model>.<action>(...) or [this.]db.<model>.<action>(...)
    // Example: this.prisma.order.create, prisma.user.findUnique
    const match = exprText.match(/(?:this\.)?(?:prisma|db)\.([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/);
    if (!match) {
      // Check if expression ends with .<model>.<action> where container is in injectedDependencies
      const parts = exprText.split('.');
      if (parts.length >= 3) {
        const action = parts[parts.length - 1];
        const model = parts[parts.length - 2];
        const baseName = parts[parts.length - 3].replace(/^this\./, '');
        const isDbDep = context.injectedDependencies.some(
          (dep) => {
            const normalized = dep.toLowerCase();
            return (
              dep === baseName &&
              (normalized.includes('prisma') ||
                normalized === 'db' ||
                normalized.endsWith('db') ||
                normalized.includes('repository'))
            );
          },
        );
        if (isDbDep) {
          if (DB_WRITE_METHODS.has(action)) {
            return {
              id: `prisma-write-${call.getStart()}`,
              type: 'DB_WRITE',
              label: `${model}.${action}`,
              location: createLocation(context.filePath, call),
              isAwaited: context.isAwaited,
              isConditional: context.isConditional,
              isGuardedByTryCatch: context.isGuardedByTryCatch,
              adapterSource: this.name,
              rawCallee: exprText,
              payload: { entity: model, method: action },
            };
          }
          if (DB_READ_METHODS.has(action)) {
            return {
              id: `prisma-read-${call.getStart()}`,
              type: 'DB_READ',
              label: `${model}.${action}`,
              location: createLocation(context.filePath, call),
              isAwaited: context.isAwaited,
              isConditional: context.isConditional,
              isGuardedByTryCatch: context.isGuardedByTryCatch,
              adapterSource: this.name,
              rawCallee: exprText,
              payload: { entity: model, method: action },
            };
          }
        }
      }
      return null;
    }

    const [, model, action] = match;
    if (DB_WRITE_METHODS.has(action)) {
      return {
        id: `prisma-write-${call.getStart()}`,
        type: 'DB_WRITE',
        label: `${model}.${action}`,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
        payload: { entity: model, method: action },
      };
    }

    if (DB_READ_METHODS.has(action)) {
      return {
        id: `prisma-read-${call.getStart()}`,
        type: 'DB_READ',
        label: `${model}.${action}`,
        location: createLocation(context.filePath, call),
        isAwaited: context.isAwaited,
        isConditional: context.isConditional,
        isGuardedByTryCatch: context.isGuardedByTryCatch,
        adapterSource: this.name,
        rawCallee: exprText,
        payload: { entity: model, method: action },
      };
    }

    return null;
  }
}
