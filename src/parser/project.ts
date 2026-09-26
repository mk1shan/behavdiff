import { Project, ts } from 'ts-morph';
import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs';

export interface ProjectLoadOptions {
  cwd?: string;
  tsConfigFilePath?: string;
  filePatterns?: string[];
  ignorePatterns?: string[];
}

export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.test.ts',
  '**/__tests__/**',
  '**/tests/fixtures/**',
];

export async function createBehavDiffProject(options: ProjectLoadOptions = {}): Promise<{ project: Project; rootDir: string; files: string[] }> {
  const rootDir = path.resolve(options.cwd || process.cwd());
  const tsConfigPath = options.tsConfigFilePath || path.join(rootDir, 'tsconfig.json');

  const project = new Project({
    tsConfigFilePath: fs.existsSync(tsConfigPath) ? tsConfigPath : undefined,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: false,
      skipLibCheck: true,
      noEmit: true,
    },
  });

  const patterns = options.filePatterns || ['**/*.ts'];
  const ignore = options.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;

  const matchedFiles = await fg(patterns, {
    cwd: rootDir,
    ignore,
    absolute: true,
  });

  for (const filePath of matchedFiles) {
    project.addSourceFileAtPath(filePath);
  }

  const syntaxDiagnostics = project.getProgram().compilerObject.getSyntacticDiagnostics();
  if (syntaxDiagnostics.length > 0) {
    const messages = syntaxDiagnostics.slice(0, 5).map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (!diagnostic.file || diagnostic.start === undefined) return message;
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `${path.relative(rootDir, diagnostic.file.fileName)}:${position.line + 1}:${position.character + 1} ${message}`;
    });
    throw new Error(`TypeScript syntax errors prevent analysis:\n${messages.join('\n')}`);
  }

  return { project, rootDir, files: matchedFiles };
}
