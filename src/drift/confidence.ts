import type {
  BaselinePattern,
  ConfidenceLevel,
  DriftDifference,
  FunctionFingerprint,
} from '../types/index.js';

export function calculateConfidence(
  target: FunctionFingerprint,
  baseline: BaselinePattern,
  differences: DriftDifference[],
): { confidence: ConfidenceLevel; reason: string } {
  const { peerCount, consensusRatio } = baseline;

  const hasCriticalDiff = differences.some(
    (d) =>
      d.affectedBehavior === 'VALIDATION' ||
      d.affectedBehavior === 'AUTH' ||
      d.type === 'NEW_EXTERNAL_EFFECT' ||
      (d.type === 'REORDERED_BEHAVIOR' &&
        (d.affectedBehavior === 'EMAIL' || d.affectedBehavior === 'HTTP_CALL')),
  );

  // High confidence conditions:
  // 1. At least 3 peers with 100% consensus and critical drift (missing validation, external effect before save, etc.)
  // 2. Or at least 5 peers with >= 80% consensus
  if (
    (peerCount >= 3 && consensusRatio === 1.0 && hasCriticalDiff) ||
    (peerCount >= 5 && consensusRatio >= 0.8 && hasCriticalDiff)
  ) {
    return {
      confidence: 'HIGH',
      reason: `${peerCount}/${baseline.totalCandidates} (${Math.round(consensusRatio * 100)}%) comparable flows follow the common sequence with critical differences observed.`,
    };
  }

  // Medium confidence:
  if (peerCount >= 3 && consensusRatio >= 0.75) {
    return {
      confidence: 'MEDIUM',
      reason: `${peerCount}/${baseline.totalCandidates} (${Math.round(consensusRatio * 100)}%) comparable flows follow the sequence.`,
    };
  }

  return {
    confidence: 'LOW',
    reason: `Small sample size or lower consensus across peer flows.`,
  };
}
