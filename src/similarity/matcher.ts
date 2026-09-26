import type {
  FunctionFingerprint,
  SimilarityResult,
} from '../types/index.js';
import { computeSimilarity } from './scoring.js';

export interface MatcherOptions {
  minScore?: number;
  maxPeers?: number;
}

export function findSimilarFlows(
  target: FunctionFingerprint,
  candidatePool: FunctionFingerprint[],
  options: MatcherOptions = {},
): SimilarityResult[] {
  const minScore = options.minScore ?? 65;
  const maxPeers = options.maxPeers ?? 10;

  const results: SimilarityResult[] = [];

  for (const candidate of candidatePool) {
    if (candidate.id === target.id) continue;

    const result = computeSimilarity(target, candidate);
    if (result.isEligiblePeer && result.score >= minScore) {
      results.push(result);
    }
  }

  // Sort by highest score first
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxPeers);
}
