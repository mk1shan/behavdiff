import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBehavDiffProject } from '../../src/parser/project.js';

describe('project loading', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('reports malformed TypeScript instead of silently analyzing zero functions', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'behavdiff-syntax-'));
    directories.push(cwd);
    fs.writeFileSync(path.join(cwd, 'broken.ts'), 'export function broken( {');

    await expect(createBehavDiffProject({ cwd })).rejects.toThrow(
      'TypeScript syntax errors prevent analysis',
    );
  });
});
