import path from 'node:path';
import { createBehavDiffProject, ProjectLoadOptions } from './parser/project.js';
import { extractFunctionsFromSourceFile } from './parser/functions.js';
import { BehaviorExtractor } from './behaviors/extractor.js';
import { findSimilarFlows } from './similarity/matcher.js';
import { discoverBaselinePattern } from './baseline/patterns.js';
import { compareBehaviorToBaseline } from './drift/comparator.js';
import { getGitDiffSummary, isFunctionInChangedRanges } from './git/diff.js';
import { loadBehavDiffConfig } from './config.js';
import type {
  ConfidenceLevel,
  DriftFinding,
  FunctionFingerprint,
  UnknownCall,
} from './types/index.js';
import type { ReporterSummary } from './reporter/terminal.js';

export * from './types/index.js';
export * from './adapters/types.js';
export * from './adapters/registry.js';
export * from './adapters/typeorm.js';
export * from './parser/project.js';
export * from './parser/functions.js';
export * from './behaviors/extractor.js';
export * from './similarity/scoring.js';
export * from './similarity/matcher.js';
export * from './baseline/patterns.js';
export * from './drift/comparator.js';
export * from './drift/confidence.js';
export * from './reporter/terminal.js';
export * from './git/diff.js';
export * from './config.js';

export interface BehavDiffOptions {
  cwd?: string;
  staged?: boolean;
  baseRef?: string;
  all?: boolean;
  minConfidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  minScore?: number;
  minPeers?: number;
  minConsensusRatio?: number;
  diagnostics?: boolean;
  configPath?: string;
  filePatterns?: string[];
  ignorePatterns?: string[];
}

export async function runBehavDiff(
  options: BehavDiffOptions = {},
): Promise<ReporterSummary> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const minConfidence = options.minConfidence || 'MEDIUM';
  const config = loadBehavDiffConfig(cwd, options.configPath);

  // 1. Load TypeScript Project
  const { project, rootDir } = await createBehavDiffProject({
    cwd,
    filePatterns: options.filePatterns,
    ignorePatterns: options.ignorePatterns,
  });

  const sourceFiles = project.getSourceFiles();

  // 2. Extract and Fingerprint All Functions
  const extractor = new BehaviorExtractor(undefined, config.behaviors);
  const allFingerprints: FunctionFingerprint[] = [];

  for (const sourceFile of sourceFiles) {
    const extractedNodes = extractFunctionsFromSourceFile(sourceFile, rootDir);
    for (const node of extractedNodes) {
      const fp = extractor.extractFingerprint(node, rootDir);
      allFingerprints.push(fp);
    }
  }

  // 3. Determine target changed functions via Git
  let targetFunctions: FunctionFingerprint[] = [];

  if (options.all) {
    targetFunctions = allFingerprints;
  } else {
    const diffSummary = await getGitDiffSummary({
      cwd,
      staged: options.staged,
      baseRef: options.baseRef,
    });

    if (!diffSummary) {
      // Not a git repo or git not found; fallback to analyzing all functions
      targetFunctions = allFingerprints;
    } else if (diffSummary.changedRanges.length === 0) {
      // Git is clean; 0 changed functions
      targetFunctions = [];
    } else {
      // Map changed line ranges to functions
      targetFunctions = allFingerprints.filter((fp) =>
        isFunctionInChangedRanges(
          fp.location.startLine,
          fp.location.endLine,
          diffSummary.changedRanges,
          fp.filePath,
        ),
      );
    }
  }

  // 4. Analyze each target function against baseline pool
  const findings: DriftFinding[] = [];
  const unclassifiedCalls: UnknownCall[] = [];
  let comparableFlowsCount = 0;

  for (const target of targetFunctions) {
    if (options.diagnostics) {
      unclassifiedCalls.push(...(target.unknownCalls ?? []));
    }
    // Search baseline in all other functions in repository
    const candidatePool = allFingerprints.filter((f) => f.id !== target.id);
    const similarPeers = findSimilarFlows(target, candidatePool, {
      minScore: options.minScore,
    });

    if (similarPeers.length > 0) {
      comparableFlowsCount++;
    }

    const baseline = discoverBaselinePattern(target, similarPeers, {
      minPeerCount: options.minPeers,
      minConsensusRatio: options.minConsensusRatio,
    });

    if (baseline) {
      const finding = compareBehaviorToBaseline(target, baseline);
      if (finding) {
        if (shouldIncludeConfidence(finding.confidence, minConfidence)) {
          findings.push(finding);
        }
      }
    }
  }

  return {
    functionsAnalyzed: allFingerprints.length,
    comparableFlowsDiscovered: comparableFlowsCount,
    changedFunctionsAnalyzed: targetFunctions.length,
    findings,
    ...(options.diagnostics
      ? {
          unclassifiedCalls: deduplicateUnknownCalls(unclassifiedCalls),
        }
      : {}),
  };
}

function deduplicateUnknownCalls(calls: UnknownCall[]): UnknownCall[] {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.location.filePath}:${call.location.startLine}:${call.location.startColumn}:${call.callee}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shouldIncludeConfidence(
  findingConfidence: ConfidenceLevel,
  minConfidence: ConfidenceLevel,
): boolean {
  const ranks: Record<ConfidenceLevel, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  return ranks[findingConfidence] >= ranks[minConfidence];
}
