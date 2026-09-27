import { describe, expect, it } from 'vitest';
import { formatTerminalReport, type ReporterSummary } from '../../src/reporter/terminal.js';

describe('terminal coverage reporting', () => {
  it('shows coverage and makes an unsupported clean result explicitly inconclusive', () => {
    const summary: ReporterSummary = {
      functionsAnalyzed: 5,
      comparableFlowsDiscovered: 0,
      changedFunctionsAnalyzed: 2,
      findings: [],
      coverage: {
        recognizedBehaviorEvents: 1,
        unclassifiedInjectedCalls: 3,
        functionsWithRecognizedBehavior: 1,
        comparableTargetFunctions: 0,
        targetFunctions: 2,
      },
    };

    const output = formatTerminalReport(summary);

    expect(output).toContain('Behavior coverage:');
    expect(output).toContain('3 unclassified injected-service calls');
    expect(output).toContain('Run with --diagnostics');
    expect(output).toContain('clean result is inconclusive');
  });
});
