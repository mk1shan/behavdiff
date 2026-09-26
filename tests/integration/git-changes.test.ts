import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBehavDiff } from '../../src/index.js';

describe('Git changed-function integration', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('detects an untracked drifted function using native platform paths', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'behavdiff-git-'));
    temporaryDirectories.push(cwd);
    fs.writeFileSync(
      path.join(cwd, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'ES2022' }, include: ['src/**/*.ts'] }),
    );
    fs.mkdirSync(path.join(cwd, 'src'));
    const baseline = (entity: string) => `
      declare function validate(value: any): void;
      export class ${entity}Service {
        constructor(private prisma: any, private mailService: any) {}
        async create${entity}(data: any) {
          validate(data);
          await this.prisma.${entity.toLowerCase()}.create({ data });
          await this.mailService.sendMail(data);
        }
      }
    `;
    for (const entity of ['Order', 'Booking', 'Invoice']) {
      fs.writeFileSync(path.join(cwd, 'src', `${entity.toLowerCase()}.ts`), baseline(entity));
    }

    execFileSync('git', ['init'], { cwd });
    execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd });
    execFileSync('git', ['config', 'user.name', 'BehavDiff Test'], { cwd });
    execFileSync('git', ['add', 'src', 'tsconfig.json'], { cwd });
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd });

    fs.writeFileSync(
      path.join(cwd, 'src', 'subscription.ts'),
      `export class SubscriptionService {
        constructor(private prisma: any, private mailService: any) {}
        async createSubscription(data: any) {
          await this.mailService.sendMail(data);
          await this.prisma.subscription.create({ data });
        }
      }`,
    );

    const summary = await runBehavDiff({ cwd });
    expect(summary.changedFunctionsAnalyzed).toBe(1);
    expect(summary.findings).toHaveLength(1);
    expect(summary.findings[0].targetFunction.name).toBe('createSubscription');
  });
});
