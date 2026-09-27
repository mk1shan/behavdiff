import { describe, it, expect } from 'vitest';
import { Project, SyntaxKind } from 'ts-morph';
import { PrismaAdapter } from '../../src/adapters/prisma.js';
import { TypeOrmAdapter } from '../../src/adapters/typeorm.js';
import { ValidationAdapter } from '../../src/adapters/validation.js';
import { EmailAdapter } from '../../src/adapters/email.js';
import { HttpAdapter } from '../../src/adapters/http.js';
import { GenericTypeScriptAdapter } from '../../src/adapters/generic-typescript.js';
import { AdapterRegistry } from '../../src/adapters/registry.js';
import { ASTContext } from '../../src/adapters/types.js';

describe('Framework Adapters', () => {
  const project = new Project({ useInMemoryFileSystem: true });

  const dummyContext: ASTContext = {
    filePath: '/test/app.service.ts',
    relativeFilePath: 'app.service.ts',
    isAwaited: true,
    isConditional: false,
    isGuardedByTryCatch: false,
    injectedDependencies: ['PrismaService', 'MailerService'],
  };

  describe('PrismaAdapter', () => {
    const adapter = new PrismaAdapter();

    it('classifies prisma create calls as DB_WRITE', () => {
      const sf = project.createSourceFile(
        'prisma-write.ts',
        'async function test() { await this.prisma.order.create({ data: {} }); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('DB_WRITE');
      expect(event?.label).toBe('order.create');
      expect(event?.payload?.entity).toBe('order');
    });

    it('classifies prisma findUnique calls as DB_READ', () => {
      const sf = project.createSourceFile(
        'prisma-read.ts',
        'async function test() { await prisma.user.findUnique({ where: { id: "1" } }); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('DB_READ');
      expect(event?.label).toBe('user.findUnique');
      expect(event?.payload?.entity).toBe('user');
    });

    it('classifies prisma $transaction as TRANSACTION_BEGIN', () => {
      const sf = project.createSourceFile(
        'prisma-tx.ts',
        'async function test() { await prisma.$transaction([]); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('TRANSACTION_BEGIN');
    });

    it('does not classify a Stripe create call as a database write', () => {
      const sf = project.createSourceFile(
        'stripe-not-prisma.ts',
        'async function test() { await this.stripe.charges.create({}); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const registry = new AdapterRegistry();
      const event = registry.classifyCall(call, {
        ...dummyContext,
        injectedDependencies: ['prisma', 'stripe'],
      });

      expect(event?.type).toBe('PAYMENT');
      expect(event?.adapterSource).toBe('generic-typescript');
    });
  });

  describe('TypeOrmAdapter', () => {
    const adapter = new TypeOrmAdapter();

    it('classifies an injected TypeORM repository read', () => {
      const sf = project.createSourceFile(
        'typeorm-read.ts',
        `import { Repository } from 'typeorm';
         class UsersService {
           constructor(private readonly userRepository: Repository<User>) {}
           async find() { return this.userRepository.findOne({ id: 1 }); }
         }`,
        { overwrite: true },
      );
      const call = sf.getDescendantsOfKind(SyntaxKind.CallExpression).at(-1)!;
      const event = adapter.classifyCall(call, dummyContext);

      expect(event?.type).toBe('DB_READ');
      expect(event?.adapterSource).toBe('typeorm');
      expect(event?.payload?.entity).toBe('user');
    });

    it('classifies an @InjectRepository write', () => {
      const sf = project.createSourceFile(
        'typeorm-write.ts',
        `import { InjectRepository } from '@nestjs/typeorm';
         import { Repository } from 'typeorm';
         class ArticlesService {
           constructor(@InjectRepository(Article) private articleRepository: Repository<Article>) {}
           async save(article: Article) { return this.articleRepository.save(article); }
         }`,
        { overwrite: true },
      );
      const call = sf.getDescendantsOfKind(SyntaxKind.CallExpression).at(-1)!;
      const event = adapter.classifyCall(call, dummyContext);

      expect(event?.type).toBe('DB_WRITE');
      expect(event?.payload?.method).toBe('save');
    });

    it('does not treat an unrelated save method as a database write', () => {
      const sf = project.createSourceFile(
        'not-typeorm.ts',
        `class SettingsService {
           constructor(private fileStore: FileStore) {}
           save() { return this.fileStore.save({}); }
         }`,
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);

      expect(adapter.classifyCall(call, dummyContext)).toBeNull();
    });

    it('classifies a TypeORM query builder terminal read', () => {
      const sf = project.createSourceFile(
        'typeorm-query-builder.ts',
        `import { SelectQueryBuilder } from 'typeorm';
         async function load(qb: SelectQueryBuilder<User>) { return qb.getMany(); }`,
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);

      expect(adapter.classifyCall(call, dummyContext)?.type).toBe('DB_READ');
    });
  });

  describe('ValidationAdapter', () => {
    const adapter = new ValidationAdapter();

    it('classifies zod schema.parse as VALIDATION', () => {
      const sf = project.createSourceFile(
        'val-zod.ts',
        'function test() { schema.parse(input); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('VALIDATION');
    });

    it('classifies validate* calls as VALIDATION', () => {
      const sf = project.createSourceFile(
        'val-fn.ts',
        'function test() { this.validateOrder(data); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('VALIDATION');
      expect(event?.label).toBe('validateOrder');
    });
  });

  describe('EmailAdapter', () => {
    const adapter = new EmailAdapter();

    it('classifies mailer sendConfirmation as EMAIL', () => {
      const sf = project.createSourceFile(
        'email-send.ts',
        'async function test() { await this.mailService.sendConfirmation("user@test.com"); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('EMAIL');
    });
  });

  describe('HttpAdapter', () => {
    const adapter = new HttpAdapter();

    it('classifies fetch calls as HTTP_CALL', () => {
      const sf = project.createSourceFile(
        'http-fetch.ts',
        'async function test() { await fetch("https://api.example.com"); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('HTTP_CALL');
    });

    it('classifies axios.post calls as HTTP_CALL', () => {
      const sf = project.createSourceFile(
        'http-axios.ts',
        'async function test() { await axios.post("/api/charge", {}); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('HTTP_CALL');
    });
  });

  describe('GenericTypeScriptAdapter', () => {
    const adapter = new GenericTypeScriptAdapter();

    it('classifies stripe charge as PAYMENT', () => {
      const sf = project.createSourceFile(
        'payment.ts',
        'async function test() { await this.stripe.charges.create({}); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('PAYMENT');
    });

    it('classifies queue add as QUEUE', () => {
      const sf = project.createSourceFile(
        'queue.ts',
        'async function test() { await this.queue.add("job", {}); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('QUEUE');
    });

    it('classifies an injected cache service set call as CACHE_WRITE', () => {
      const sf = project.createSourceFile(
        'cache-service.ts',
        'async function test() { await this.cacheService.set("key", "value"); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);
      const event = adapter.classifyCall(call, dummyContext);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('CACHE_WRITE');
    });

    it('does not classify an unrelated set call as cache behavior', () => {
      const sf = project.createSourceFile(
        'settings.ts',
        'async function test() { await this.settingsService.set("key", "value"); }',
        { overwrite: true },
      );
      const call = sf.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression);

      expect(adapter.classifyCall(call, dummyContext)).toBeNull();
    });
  });
});
