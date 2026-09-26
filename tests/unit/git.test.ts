import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { isFunctionInChangedRanges, normalizeFilePath } from '../../src/git/diff.js';

describe('Git path mapping', () => {
  it('normalizes Windows and POSIX separators consistently', () => {
    const native = path.resolve('src/example.ts');
    const alternate = native.replace(/\\/g, '/');
    expect(normalizeFilePath(native)).toBe(normalizeFilePath(alternate));
  });

  it('maps a Git range to an AST function across separator styles', () => {
    const native = path.resolve('src/example.ts');
    const gitStyle = native.replace(/\\/g, '/');
    expect(
      isFunctionInChangedRanges(
        10,
        20,
        [{ filePath: gitStyle, startLine: 12, endLine: 12 }],
        native,
      ),
    ).toBe(true);
  });
});
