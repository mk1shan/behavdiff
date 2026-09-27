import { Node, type CallExpression, type Expression } from 'ts-morph';
import type { BehaviorEvent, BehaviorType } from '../types/index.js';
import { FrameworkAdapter, ASTContext, createLocation } from './types.js';

const READ_METHODS = new Set([
  'find',
  'findOne',
  'findOneBy',
  'findOneOrFail',
  'findBy',
  'findAndCount',
  'findAndCountBy',
  'count',
  'countBy',
  'exist',
  'exists',
  'existsBy',
  'query',
]);

const WRITE_METHODS = new Set([
  'save',
  'insert',
  'update',
  'upsert',
  'delete',
  'remove',
  'softDelete',
  'softRemove',
  'restore',
  'recover',
  'increment',
  'decrement',
  'clear',
]);

const QUERY_BUILDER_READ_METHODS = new Set([
  'getOne',
  'getOneOrFail',
  'getMany',
  'getCount',
  'getManyAndCount',
  'getRawOne',
  'getRawMany',
  'getRawAndEntities',
  'stream',
]);

export class TypeOrmAdapter implements FrameworkAdapter {
  readonly name = 'typeorm';
  readonly order = 11;

  classifyCall(call: CallExpression, context: ASTContext): BehaviorEvent | null {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return null;

    const method = expression.getName();
    const repositoryType = READ_METHODS.has(method)
      ? 'DB_READ'
      : WRITE_METHODS.has(method)
        ? 'DB_WRITE'
        : null;
    const receiverExpression = expression.getExpression();
    const isRepository = this.isTypeOrmRepository(receiverExpression);
    const isQueryBuilder = this.isTypeOrmQueryBuilder(receiverExpression);
    const type = isRepository
      ? repositoryType
      : isQueryBuilder && QUERY_BUILDER_READ_METHODS.has(method)
        ? 'DB_READ'
        : isQueryBuilder && method === 'execute'
          ? 'DB_WRITE'
          : null;
    if (!type) return null;

    const receiver = receiverExpression.getText();
    const entity = receiver.split('.').at(-1)?.replace(/Repository$/i, '') || receiver;
    return this.createEvent(call, context, type, receiver, method, entity);
  }

  private isTypeOrmQueryBuilder(receiver: Expression): boolean {
    return /(?:Select|Insert|Update|Delete|SoftDelete|Relation)?QueryBuilder</.test(
      receiver.getType().getText(),
    );
  }

  private isTypeOrmRepository(receiver: Expression): boolean {
    const typeText = receiver.getType().getText();
    if (/(?:^|\.)Repository<|(?:^|\.)TreeRepository<|(?:^|\.)MongoRepository</.test(typeText)) {
      return true;
    }

    let symbol = receiver.getSymbol();
    if (!symbol) return false;
    if (symbol.isAlias()) symbol = symbol.getAliasedSymbol() ?? symbol;

    return symbol.getDeclarations().some((declaration) => {
      if (!Node.isParameterDeclaration(declaration) && !Node.isPropertyDeclaration(declaration)) {
        return false;
      }

      const declaredType = declaration.getTypeNode()?.getText() ?? '';
      const hasRepositoryType = /(?:^|\.)?(?:Repository|TreeRepository|MongoRepository)\s*</.test(declaredType);
      const hasInjectRepository = declaration
        .getDecorators()
        .some((decorator) => decorator.getName() === 'InjectRepository');
      if (!hasRepositoryType && !hasInjectRepository) return false;

      const sourceFile = declaration.getSourceFile();
      return sourceFile.getImportDeclarations().some((importDeclaration) => {
        const moduleName = importDeclaration.getModuleSpecifierValue();
        return moduleName === 'typeorm' || moduleName === '@nestjs/typeorm';
      });
    });
  }

  private createEvent(
    call: CallExpression,
    context: ASTContext,
    type: BehaviorType,
    receiver: string,
    method: string,
    entity: string,
  ): BehaviorEvent {
    return {
      id: `typeorm-${type.toLowerCase()}-${call.getStart()}`,
      type,
      label: `${receiver}.${method}`,
      location: createLocation(context.filePath, call),
      isAwaited: context.isAwaited,
      isConditional: context.isConditional,
      isGuardedByTryCatch: context.isGuardedByTryCatch,
      adapterSource: this.name,
      rawCallee: call.getExpression().getText(),
      payload: { entity, method },
    };
  }
}
