import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runBehavDiff } from '../../src/index.js';

describe('False Positive Prevention', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/ecommerce');

  it('never compares healthCheck or getOrder against createOrder', async () => {
    const summary = await runBehavDiff({
      cwd: fixtureDir,
      all: true,
      filePatterns: ['**/*.ts'],
      ignorePatterns: [],
    });

    // Verify no findings exist for healthCheck, getOrder, or conforming functions
    const healthCheckFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'healthCheck',
    );
    expect(healthCheckFinding).toBeUndefined();

    const getOrderFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'getOrder',
    );
    expect(getOrderFinding).toBeUndefined();

    const createOrderFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'createOrder',
    );
    expect(createOrderFinding).toBeUndefined();

    const createBookingFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'createBooking',
    );
    expect(createBookingFinding).toBeUndefined();

    const createInvoiceFinding = summary.findings.find(
      (f) => f.targetFunction.name === 'createInvoice',
    );
    expect(createInvoiceFinding).toBeUndefined();
  });
});
