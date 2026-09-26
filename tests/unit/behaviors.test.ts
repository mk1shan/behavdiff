import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractFunctionsFromSourceFile } from '../../src/parser/functions.js';
import { BehaviorExtractor } from '../../src/behaviors/extractor.js';

describe('Function Extraction & Behavior Fingerprinting', () => {
  const project = new Project({ useInMemoryFileSystem: true });
  const extractor = new BehaviorExtractor();

  it('preserves exact execution sequence: VALIDATION -> DB_WRITE -> EMAIL', () => {
    const code = `
      export class OrderService {
        constructor(private prisma: any, private mailer: any) {}

        async createOrder(dto: CreateOrderDto) {
          this.validateOrder(dto);
          await this.prisma.order.create({ data: dto });
          await this.mailer.sendEmail(dto.email);
        }

        private validateOrder(dto: any) {}
      }
    `;

    const sf = project.createSourceFile('order.service.ts', code, { overwrite: true });
    const extracted = extractFunctionsFromSourceFile(sf, '/');
    const orderMethod = extracted.find((f) => f.name === 'createOrder');

    expect(orderMethod).toBeDefined();
    expect(orderMethod?.enclosingClass).toBe('OrderService');
    expect(orderMethod?.parameters[0].isDtoLike).toBe(true);

    const fp = extractor.extractFingerprint(orderMethod!, '/');
    expect(fp.sequence).toEqual(['VALIDATION', 'DB_WRITE', 'EMAIL']);
    expect(fp.targetEntities).toContain('order');
    expect(fp.behaviors[1].isAwaited).toBe(true);
  });

  it('flags conditional behaviors properly inside if-statements', () => {
    const code = `
      export class UserService {
        constructor(private prisma: any) {}

        async updateUser(id: string, data: any) {
          if (data.role) {
            await this.prisma.user.update({ where: { id }, data });
          }
        }
      }
    `;

    const sf = project.createSourceFile('user.service.ts', code, { overwrite: true });
    const extracted = extractFunctionsFromSourceFile(sf, '/');
    const method = extracted.find((f) => f.name === 'updateUser');

    const fp = extractor.extractFingerprint(method!, '/');
    expect(fp.behaviors[0].isConditional).toBe(true);
    expect(fp.behaviors[0].type).toBe('DB_WRITE');
  });

  it('flags try-catch guarded behaviors', () => {
    const code = `
      export class PaymentService {
        constructor(private stripe: any) {}

        async charge(data: any) {
          try {
            await this.stripe.charges.create(data);
          } catch (err) {
            console.error(err);
          }
        }
      }
    `;

    const sf = project.createSourceFile('payment.service.ts', code, { overwrite: true });
    const extracted = extractFunctionsFromSourceFile(sf, '/');
    const method = extracted.find((f) => f.name === 'charge');

    const fp = extractor.extractFingerprint(method!, '/');
    expect(fp.behaviors[0].isGuardedByTryCatch).toBe(true);
    expect(fp.behaviors[0].type).toBe('PAYMENT');
  });

  it('expands one level of local helper calls in execution order', () => {
    const code = `
      export class SubscriptionService {
        constructor(private prisma: any, private mailer: any) {}

        async createSubscription(data: any) {
          await this.notify(data);
          await this.persist(data);
        }

        private async notify(data: any) {
          await this.mailer.sendEmail(data.email);
        }

        private async persist(data: any) {
          await this.prisma.subscription.create({ data });
        }
      }
    `;

    const sf = project.createSourceFile('subscription.service.ts', code, { overwrite: true });
    const extracted = extractFunctionsFromSourceFile(sf, '/');
    const method = extracted.find((f) => f.name === 'createSubscription');
    const fp = extractor.extractFingerprint(method!, '/');

    expect(fp.sequence).toEqual(['EMAIL', 'DB_WRITE']);
  });
});
