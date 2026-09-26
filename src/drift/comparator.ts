import type {
  BehaviorType,
  BaselinePattern,
  DriftDifference,
  DriftFinding,
  FunctionFingerprint,
} from '../types/index.js';
import { calculateConfidence } from './confidence.js';

export function compareBehaviorToBaseline(
  target: FunctionFingerprint,
  baseline: BaselinePattern,
): DriftFinding | null {
  const targetSeq = target.sequence;
  const baseSeq = baseline.dominantSequence;

  const differences: DriftDifference[] = [];

  // 1. Missing behavior occurrences
  const remainingTargetCounts = countBehaviors(targetSeq);
  for (let i = 0; i < baseSeq.length; i++) {
    const expected = baseSeq[i];
    const remaining = remainingTargetCounts.get(expected) ?? 0;
    if (remaining === 0) {
      differences.push({
        type: 'MISSING_BEHAVIOR',
        description: `${expected} step not observed`,
        affectedBehavior: expected,
        expectedIndex: i,
        evidenceSnippet: `Expected in baseline step ${i + 1}`,
      });
    } else {
      remainingTargetCounts.set(expected, remaining - 1);
    }
  }

  // 2. Reordered behaviors
  // For any pair (A, B) where A occurs before B in baseline, check if B occurs before A in target
  for (let i = 0; i < baseSeq.length; i++) {
    for (let j = i + 1; j < baseSeq.length; j++) {
      const bFirst = baseSeq[i];
      const bSecond = baseSeq[j];

      const tFirstIndex = targetSeq.indexOf(bFirst);
      const tSecondIndex = targetSeq.indexOf(bSecond);

      if (tFirstIndex !== -1 && tSecondIndex !== -1 && tSecondIndex < tFirstIndex) {
        // Avoid duplicate pair warnings if already reported
        const alreadyReported = differences.some(
          (d) =>
            d.type === 'REORDERED_BEHAVIOR' &&
            d.affectedBehavior === bSecond &&
            d.relativeToBehavior === bFirst,
        );
        if (!alreadyReported) {
          differences.push({
            type: 'REORDERED_BEHAVIOR',
            description: `${bSecond} now occurs before ${bFirst}`,
            affectedBehavior: bSecond,
            relativeToBehavior: bFirst,
            expectedIndex: tFirstIndex,
            actualIndex: tSecondIndex,
          });
        }
      }
    }
  }

  // 3. Added behavior occurrences
  const remainingBaseCounts = countBehaviors(baseSeq);
  for (let i = 0; i < targetSeq.length; i++) {
    const actual = targetSeq[i];
    const remaining = remainingBaseCounts.get(actual) ?? 0;
    if (remaining > 0) {
      remainingBaseCounts.set(actual, remaining - 1);
    } else {
      const isExternal = [
        'EMAIL',
        'HTTP_CALL',
        'PAYMENT',
        'QUEUE',
        'UNKNOWN_EXTERNAL_EFFECT',
      ].includes(actual);

      const targetDbWriteIndex = targetSeq.indexOf('DB_WRITE');
      if (isExternal && targetDbWriteIndex !== -1 && i < targetDbWriteIndex) {
        differences.push({
          type: 'NEW_EXTERNAL_EFFECT',
          description: `New external ${actual} effect occurs before database persistence`,
          affectedBehavior: actual,
          actualIndex: i,
        });
      } else {
        differences.push({
          type: 'ADDED_BEHAVIOR',
          description: `New ${actual} behavior introduced`,
          affectedBehavior: actual,
          actualIndex: i,
        });
      }
    }
  }

  if (differences.length === 0) {
    return null; // No drift found
  }

  const { confidence, reason } = calculateConfidence(target, baseline, differences);

  const comparedPeers = baseline.peers.map((p) => ({
    name: p.name,
    filePath: p.filePath,
    relativeFilePath: p.relativeFilePath,
    line: p.location.startLine,
    sequence: p.sequence,
    score: baseline.peerEvidence?.find((evidence) => evidence.functionId === p.id)?.score,
    reasons: baseline.peerEvidence?.find((evidence) => evidence.functionId === p.id)?.reasons,
  }));

  return {
    targetFunction: target,
    baseline,
    differences,
    confidence,
    confidenceReason: reason,
    comparedPeers,
  };
}

function countBehaviors(sequence: BehaviorType[]): Map<BehaviorType, number> {
  const counts = new Map<BehaviorType, number>();
  for (const behavior of sequence) {
    counts.set(behavior, (counts.get(behavior) ?? 0) + 1);
  }
  return counts;
}
