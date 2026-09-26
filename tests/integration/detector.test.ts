import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runBehavDiff } from '../../src/index.js';

describe('End-to-End Detector Integration', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/ecommerce');

  it('accurately detects drift in createSubscription against order/booking/invoice baseline', async () => {
    const summary = await runBehavDiff({
      cwd: fixtureDir,
      all: true, // Analyze all functions in fixture
      filePatterns: ['**/*.ts'],
      ignorePatterns: [],
    });

    expect(summary.functionsAnalyzed).toBeGreaterThanOrEqual(4);

    // Look for createSubscription finding
    const subFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'createSubscription',
    );

    expect(subFinding).toBeDefined();
    expect(subFinding?.baseline.dominantSequence).toEqual([
      'VALIDATION',
      'DB_WRITE',
      'EMAIL',
    ]);
    expect(subFinding?.targetFunction.sequence).toEqual([
      'EMAIL',
      'DB_WRITE',
    ]);

    const descriptions = subFinding?.differences.map((d) => d.description);
    expect(descriptions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('VALIDATION step not observed'),
        expect.stringContaining('EMAIL now occurs before DB_WRITE'),
      ]),
    );

    expect(subFinding?.confidence).toBe('HIGH');
  });
});
