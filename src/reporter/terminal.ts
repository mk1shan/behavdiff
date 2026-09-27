import pc from 'picocolors';
import type { DriftFinding, UnknownCall } from '../types/index.js';

export interface ReporterSummary {
  functionsAnalyzed: number;
  comparableFlowsDiscovered: number;
  changedFunctionsAnalyzed: number;
  findings: DriftFinding[];
  coverage: {
    recognizedBehaviorEvents: number;
    unclassifiedInjectedCalls: number;
    functionsWithRecognizedBehavior: number;
    comparableTargetFunctions: number;
    targetFunctions: number;
  };
  unclassifiedCalls?: UnknownCall[];
}

export function formatTerminalReport(summary: ReporterSummary): string {
  const lines: string[] = [];

  // Header / Progress
  lines.push('');
  lines.push(pc.bold(pc.cyan('BehavDiff')) + pc.gray(' — Behavioral Drift Detector'));
  lines.push('');
  lines.push(`  ${pc.green('✓')} ${pc.bold(summary.functionsAnalyzed.toString())} functions indexed`);
  lines.push(
    `  ${pc.green('✓')} ${pc.bold(summary.comparableFlowsDiscovered.toString())} comparable flows discovered`,
  );
  lines.push(
    `  ${pc.green('✓')} ${pc.bold(summary.changedFunctionsAnalyzed.toString())} changed functions analyzed`,
  );
  lines.push('');

  lines.push(pc.dim('Behavior coverage:'));
  lines.push(
    `  ${summary.coverage.recognizedBehaviorEvents} recognized behavior events across ${summary.coverage.functionsWithRecognizedBehavior}/${summary.coverage.targetFunctions} target functions`,
  );
  lines.push(
    `  ${summary.coverage.unclassifiedInjectedCalls} unclassified injected-service calls`,
  );
  lines.push(
    `  ${summary.coverage.comparableTargetFunctions}/${summary.coverage.targetFunctions} target functions have comparable peers`,
  );
  if (summary.coverage.unclassifiedInjectedCalls > 0 && !summary.unclassifiedCalls) {
    lines.push(pc.yellow('  Run with --diagnostics to list unclassified calls.'));
  }
  lines.push('');

  if (summary.unclassifiedCalls) {
    lines.push(pc.dim('Unclassified injected-service calls (diagnostic only):'));
    if (summary.unclassifiedCalls.length === 0) {
      lines.push('  None found.');
    } else {
      for (const call of summary.unclassifiedCalls) {
        lines.push(`  ${pc.yellow(call.callee)} ${pc.gray(`(${call.location.filePath}:${call.location.startLine})`)}`);
      }
    }
    lines.push('');
  }

  if (summary.findings.length === 0) {
    if (
      summary.coverage.targetFunctions > 0 &&
      summary.coverage.comparableTargetFunctions === 0
    ) {
      lines.push(pc.yellow('Coverage is limited: no target function had comparable peers.'));
      lines.push(pc.yellow('The clean result is inconclusive for behavioral drift.'));
      lines.push('');
    }
    lines.push(pc.green('✔ No behavioral anomalies detected across changed code.'));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(
    pc.bold(
      pc.yellow(
        `⚠ ${summary.findings.length} BEHAVIORAL DRIFT ${summary.findings.length === 1 ? 'FINDING' : 'FINDINGS'} DETECTED`,
      ),
    ),
  );
  lines.push('');

  for (let idx = 0; idx < summary.findings.length; idx++) {
    const finding = summary.findings[idx];
    const target = finding.targetFunction;
    const base = finding.baseline;

    lines.push(
      pc.bold(
        pc.underline(
          `${target.relativeFilePath}:${target.location.startLine}`,
        ),
      ),
    );
    lines.push(pc.bold(pc.cyan(`${target.name}()`)));
    lines.push('');

    // Common vs New behavior
    lines.push(pc.dim('Common behavior:'));
    lines.push(`  ${pc.green(base.dominantSequence.join(' → ') || '(none)')}`);
    lines.push('');

    lines.push(pc.dim('New behavior:'));
    lines.push(`  ${pc.yellow(target.sequence.join(' → ') || '(none)')}`);
    lines.push('');

    // Differences
    lines.push(pc.dim('Differences:'));
    for (const diff of finding.differences) {
      lines.push(`  ${pc.red('•')} ${diff.description}`);
    }
    lines.push('');

    // Compared Against
    lines.push(pc.dim('Compared against:'));
    for (const peer of finding.comparedPeers) {
      lines.push(
        `  ${pc.gray('•')} ${pc.cyan(peer.name + '()')} ${pc.gray(`(${peer.relativeFilePath}:${peer.line})`)}`,
      );
    }
    for (let peerIndex = 0; peerIndex < finding.comparedPeers.length; peerIndex++) {
      const peer = finding.comparedPeers[peerIndex];
      const peerLineIndex = lines.length - finding.comparedPeers.length + peerIndex;
      const reasons = peer.reasons?.length ? peer.reasons.join(', ') : 'similar function role and intent';
      lines[peerLineIndex] += ` — score ${peer.score ?? 'n/a'}; selected because: ${reasons}`;
    }
    lines.push('');

    // Evidence & Confidence
    const pct = Math.round(base.consensusRatio * 100);
    lines.push(pc.dim('Evidence:'));
    lines.push(
      `  ${base.peerCount}/${base.totalCandidates} (${pct}%) comparable ${base.intentCluster.toLowerCase()} flows follow the common sequence.`,
    );
    lines.push('');

    const confBadge =
      finding.confidence === 'HIGH'
        ? pc.bgRed(pc.white(pc.bold(' HIGH ')))
        : finding.confidence === 'MEDIUM'
          ? pc.bgYellow(pc.black(pc.bold(' MEDIUM ')))
          : pc.gray(pc.bold('[LOW]'));

    lines.push(`Confidence: ${confBadge}`);
    lines.push('');
    lines.push(pc.italic(pc.gray('Review recommended.')));
    lines.push('');
    if (idx < summary.findings.length - 1) {
      lines.push(pc.gray('―'.repeat(50)));
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function formatJsonReport(summary: ReporterSummary): string {
  return JSON.stringify(summary, null, 2);
}
