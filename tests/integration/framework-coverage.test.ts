import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { BehaviorExtractor } from '../../src/behaviors/extractor.js';
import { extractFunctionsFromSourceFile } from '../../src/parser/functions.js';
import { createBehavDiffProject } from '../../src/parser/project.js';

describe('real-framework fixture coverage', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/frameworks');

  it('recognizes TypeORM, Prisma, and NestJS without misclassifying generic save calls', async () => {
    const { project, rootDir } = await createBehavDiffProject({
      cwd: fixtureDir,
      filePatterns: ['**/*.ts'],
      ignorePatterns: [],
    });
    const extractor = new BehaviorExtractor();
    const fingerprints = project.getSourceFiles().flatMap((sourceFile) =>
      extractFunctionsFromSourceFile(sourceFile, rootDir).map((fn) =>
        extractor.extractFingerprint(fn, rootDir),
      ),
    );
    const get = (className: string, method: string) =>
      fingerprints.find(
        (fingerprint) =>
          fingerprint.enclosingClassOrObject === className && fingerprint.name === method,
      );

    expect(get('TypeOrmUserService', 'findUser')?.sequence).toEqual(['DB_READ']);
    expect(get('TypeOrmUserService', 'updateUser')?.sequence).toEqual(['DB_WRITE']);
    expect(get('PrismaUserService', 'findUser')?.sequence).toEqual(['DB_READ']);
    expect(get('PrismaUserService', 'updateUser')?.sequence).toEqual(['DB_WRITE']);
    expect(get('UsersController', 'findUsers')?.sequence).toEqual(['AUTH', 'VALIDATION']);
    expect(get('SettingsService', 'saveSettings')?.sequence).toEqual([]);
  });
});
