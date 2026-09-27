import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBehavDiff } from '../../src/index.js';

describe('coverage and Git analysis modes', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('falls back to all functions outside Git and reports unknown injected calls', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'behavdiff-no-git-'));
    temporaryDirectories.push(cwd);
    fs.writeFileSync(
      path.join(cwd, 'example.ts'),
      `export class ExampleService {
        constructor(private mysteryService: any) {}
        async process() { await this.mysteryService.perform(); }
      }`,
    );

    const normal = await runBehavDiff({ cwd, filePatterns: ['**/*.ts'], ignorePatterns: [] });
    const diagnostic = await runBehavDiff({
      cwd,
      diagnostics: true,
      filePatterns: ['**/*.ts'],
      ignorePatterns: [],
    });

    expect(normal.changedFunctionsAnalyzed).toBe(1);
    expect(normal.coverage.unclassifiedInjectedCalls).toBe(1);
    expect(normal.unclassifiedCalls).toBeUndefined();
    expect(diagnostic.unclassifiedCalls?.[0].callee).toBe('this.mysteryService.perform');
  });

  it('analyzes an existing staged function against committed peers', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'behavdiff-staged-'));
    temporaryDirectories.push(cwd);
    fs.mkdirSync(path.join(cwd, 'src'));
    fs.writeFileSync(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022' }, include: ['src/**/*.ts'] }),
    );
    const flow = (entity: string) => `export class ${entity}Service {
      constructor(private prisma: any, private mailService: any) {}
      async create${entity}(data: any) {
        this.validate${entity}(data);
        await this.prisma.${entity.toLowerCase()}.create({ data });
        await this.mailService.sendMail(data);
      }
      private validate${entity}(data: any) {}
    }`;
    for (const entity of ['Order', 'Booking', 'Invoice', 'Subscription']) {
      fs.writeFileSync(path.join(cwd, 'src', `${entity.toLowerCase()}.ts`), flow(entity));
    }

    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd });
    execFileSync('git', ['config', 'user.name', 'BehavDiff Test'], { cwd });
    execFileSync('git', ['add', '.'], { cwd });
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd });

    fs.writeFileSync(
      path.join(cwd, 'src', 'subscription.ts'),
      `export class SubscriptionService {
        constructor(private prisma: any, private mailService: any) {}
        async createSubscription(data: any) {
          await this.mailService.sendMail(data);
          await this.prisma.subscription.create({ data });
        }
        private validateSubscription(data: any) {}
      }`,
    );
    execFileSync('git', ['add', 'src/subscription.ts'], { cwd });

    const summary = await runBehavDiff({ cwd, staged: true });

    expect(summary.changedFunctionsAnalyzed).toBeGreaterThanOrEqual(1);
    expect(summary.findings).toHaveLength(1);
    expect(summary.findings[0].targetFunction.name).toBe('createSubscription');
  });
});
