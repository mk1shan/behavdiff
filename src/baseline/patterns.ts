import type {
  BehaviorType,
  BaselinePattern,
  FunctionFingerprint,
  SimilarityResult,
} from '../types/index.js';
import { extractIntent } from '../similarity/scoring.js';

export interface BaselineOptions {
  minPeerCount?: number;
  minConsensusRatio?: number;
}

export function discoverBaselinePattern(
  target: FunctionFingerprint,
  similarPeers: SimilarityResult[],
  options: BaselineOptions = {},
): BaselinePattern | null {
  const minPeerCount = options.minPeerCount ?? 3;
  const minConsensusRatio = options.minConsensusRatio ?? 0.75;

  if (similarPeers.length < minPeerCount) {
    return null; // Insufficient evidence to claim a baseline
  }

  const peers = similarPeers.map((sp) => sp.peerFunction);

  // Group peers by serialized behavior sequence
  const sequenceCounts = new Map<string, { sequence: BehaviorType[]; count: number; matchingPeers: FunctionFingerprint[] }>();

  for (const peer of peers) {
    const key = peer.sequence.join(' → ');
    const existing = sequenceCounts.get(key);
    if (existing) {
      existing.count++;
      existing.matchingPeers.push(peer);
    } else {
      sequenceCounts.set(key, {
        sequence: peer.sequence,
        count: 1,
        matchingPeers: [peer],
      });
    }
  }

  // Find dominant sequence
  let dominantEntry: { sequence: BehaviorType[]; count: number; matchingPeers: FunctionFingerprint[] } | null = null;
  for (const entry of sequenceCounts.values()) {
    if (!dominantEntry || entry.count > dominantEntry.count) {
      dominantEntry = entry;
    }
  }

  if (!dominantEntry) return null;

  const consensusRatio = dominantEntry.count / peers.length;
  if (consensusRatio < minConsensusRatio) {
    return null; // Codebase has divergent behaviors; no dominant convention
  }

  return {
    role: target.role,
    intentCluster: extractIntent(target.name),
    dominantSequence: dominantEntry.sequence,
    peers: dominantEntry.matchingPeers,
    peerEvidence: similarPeers
      .filter((peer) => dominantEntry!.matchingPeers.some((matching) => matching.id === peer.peerFunction.id))
      .map((peer) => ({
        functionId: peer.peerFunction.id,
        score: peer.score,
        reasons: peer.selectionReasons ?? [],
      })),
    peerCount: dominantEntry.count,
    totalCandidates: peers.length,
    consensusRatio,
  };
}
