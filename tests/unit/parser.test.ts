import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { extractFunctionsFromSourceFile } from '../../src/parser/functions.js';

describe('function metadata extraction', () => {
  it('records dependency names without polluting them with type names', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const source = project.createSourceFile(
      '/src/example.ts',
      'class ExampleService { constructor(private prisma: any, private mailService: MailService) {} run() {} }',
    );
    const [method] = extractFunctionsFromSourceFile(source, '/');
    expect(method.injectedDependencies).toEqual(['prisma', 'mailService']);
  });
});
