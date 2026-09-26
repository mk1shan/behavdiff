import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import type { GitChangedRange, GitDiffSummary } from '../types/index.js';

const execFileAsync = promisify(execFile);

export interface GitDiffOptions {
  cwd?: string;
  staged?: boolean;
  baseRef?: string;
}

export function normalizeFilePath(filePath: string): string {
  const resolved = path.resolve(filePath).replace(/\\/g, '/');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export async function getGitDiffSummary(
  options: GitDiffOptions = {},
): Promise<GitDiffSummary | null> {
  const cwd = path.resolve(options.cwd || process.cwd());

  // First check if inside a git repository
  try {
    await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  } catch {
    return null; // Not a git repository
  }

  const args: string[] = ['diff', '-U0'];

  if (options.staged) {
    args.push('--staged');
  } else if (options.baseRef) {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--verify', `${options.baseRef}^{commit}`],
      { cwd },
    );
    args.push(`${stdout.trim()}...HEAD`);
  } else {
    // Check if HEAD exists (repo might be empty with no commits yet)
    try {
      await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
      args.push('HEAD');
    } catch {
      // No commits yet, just run git diff
    }
  }

  const changedRanges: GitChangedRange[] = [];
  const changedFilesSet = new Set<string>();

  try {
    const { stdout: diffOutput } = await execFileAsync('git', args, { cwd });
    parseUnifiedDiff(diffOutput, cwd, changedRanges, changedFilesSet);
  } catch (err) {
    // If diff command failed, proceed to untracked files
  }

  // Untracked files are working-tree changes, never staged changes.
  if (options.staged || options.baseRef) {
    return {
      changedFiles: Array.from(changedFilesSet),
      changedRanges,
    };
  }

  // Also inspect untracked new files via NUL-delimited Git status output.
  try {
    const { stdout: statusOutput } = await execFileAsync(
      'git',
      ['status', '--porcelain=v1', '-z', '-uall'],
      { cwd, encoding: 'utf8' },
    );
    for (const entry of statusOutput.split('\0')) {
      if (entry.startsWith('?? ')) {
        const relPath = entry.substring(3);
        if (relPath.endsWith('.ts') && !relPath.endsWith('.d.ts')) {
          const fullPath = path.resolve(cwd, relPath);
          changedFilesSet.add(fullPath);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const totalLines = content.split('\n').length;
            changedRanges.push({
              filePath: fullPath,
              startLine: 1,
              endLine: Math.max(1, totalLines),
            });
          }
        }
      }
    }
  } catch {
    // Ignore status errors
  }

  return {
    changedFiles: Array.from(changedFilesSet),
    changedRanges,
  };
}

export function parseUnifiedDiff(
  diffOutput: string,
  rootDir: string,
  outRanges: GitChangedRange[],
  outFiles: Set<string>,
): void {
  const lines = diffOutput.split('\n');
  let currentFile: string | null = null;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      // Format: diff --git a/src/index.ts b/src/index.ts
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (match) {
        const bPath = match[2];
        if (bPath.endsWith('.ts') && !bPath.endsWith('.d.ts')) {
          currentFile = path.resolve(rootDir, bPath);
          outFiles.add(currentFile);
        } else {
          currentFile = null;
        }
      }
    } else if (currentFile && line.startsWith('@@ ')) {
      // Format: @@ -oldStart,oldLen +newStart,newLen @@
      // or:     @@ -oldStart +newStart,newLen @@
      // or:     @@ -oldStart,oldLen +newStart @@
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const newStart = parseInt(match[1], 10);
        const newCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        const endLine = newCount === 0 ? newStart : newStart + newCount - 1;

        outRanges.push({
          filePath: currentFile,
          startLine: newStart,
          endLine: Math.max(newStart, endLine),
        });
      }
    }
  }
}

export function isFunctionInChangedRanges(
  functionStartLine: number,
  functionEndLine: number,
  ranges: GitChangedRange[],
  filePath: string,
): boolean {
  for (const range of ranges) {
    if (normalizeFilePath(range.filePath) === normalizeFilePath(filePath)) {
      // Overlap check: startA <= endB && endA >= startB
      if (functionStartLine <= range.endLine && functionEndLine >= range.startLine) {
        return true;
      }
    }
  }
  return false;
}
