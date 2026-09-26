export type BehaviorType =
  | 'AUTH'
  | 'VALIDATION'
  | 'DB_READ'
  | 'DB_WRITE'
  | 'HTTP_CALL'
  | 'EMAIL'
  | 'PAYMENT'
  | 'QUEUE'
  | 'CACHE_READ'
  | 'CACHE_WRITE'
  | 'TRANSACTION_BEGIN'
  | 'TRANSACTION_END'
  | 'UNKNOWN_EXTERNAL_EFFECT';

export interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface BehaviorEvent {
  id: string;
  type: BehaviorType;
  label: string; // e.g. "prisma.order.create", "sendMail", "@UseGuards"
  location: SourceLocation;
  isAwaited: boolean;
  isConditional: boolean;
  isGuardedByTryCatch: boolean;
  adapterSource: string;
  rawCallee: string;
  payload?: Record<string, unknown>;
}

export type FrameworkRole =
  | 'nestjs-controller-method'
  | 'generic-controller-method'
  | 'nestjs-service-method'
  | 'express-route-handler'
  | 'generic-service-method'
  | 'standalone-function'
  | 'unknown';

export interface ParameterInfo {
  name: string;
  typeText?: string;
  isDtoLike: boolean;
}

export interface FunctionFingerprint {
  id: string; // filePath::container::name::line
  name: string;
  filePath: string;
  relativeFilePath: string;
  enclosingClassOrObject?: string;
  role: FrameworkRole;
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  routePath?: string;
  parameters: ParameterInfo[];
  returnTypeText?: string;
  decorators: string[];
  injectedDependencies: string[];
  targetEntities: string[];
  behaviors: BehaviorEvent[];
  sequence: BehaviorType[];
  /** Calls on injected dependencies that no adapter or local helper resolved. */
  unknownCalls?: UnknownCall[];
  location: SourceLocation;
}

export interface UnknownCall {
  callee: string;
  location: SourceLocation;
}

export interface SimilarityBreakdown {
  roleMatchScore: number;       // Max: 25
  namingIntentScore: number;    // Max: 25
  moduleProximityScore: number; // Max: 15
  entityOverlapScore: number;   // Max: 20
  structuralScore: number;      // Max: 15
  totalScore: number;           // 0 - 100
}

export interface SimilarityResult {
  targetFunction: FunctionFingerprint;
  peerFunction: FunctionFingerprint;
  score: number; // 0 - 100
  breakdown: SimilarityBreakdown;
  isEligiblePeer: boolean;
  rejectionReason?: string;
  selectionReasons?: string[];
}

export interface BaselinePattern {
  role: FrameworkRole;
  intentCluster: string; // e.g., "CREATE"
  dominantSequence: BehaviorType[];
  peers: FunctionFingerprint[];
  peerEvidence?: Array<{
    functionId: string;
    score: number;
    reasons: string[];
  }>;
  peerCount: number;
  totalCandidates: number;
  consensusRatio: number; // e.g. 1.0 (3/3)
}

export type DriftType =
  | 'MISSING_BEHAVIOR'
  | 'ADDED_BEHAVIOR'
  | 'REORDERED_BEHAVIOR'
  | 'NEW_EXTERNAL_EFFECT';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DriftDifference {
  type: DriftType;
  description: string;
  affectedBehavior: BehaviorType;
  expectedIndex?: number;
  actualIndex?: number;
  relativeToBehavior?: BehaviorType;
  evidenceSnippet?: string;
}

export interface DriftFinding {
  targetFunction: FunctionFingerprint;
  baseline: BaselinePattern;
  differences: DriftDifference[];
  confidence: ConfidenceLevel;
  confidenceReason: string;
  comparedPeers: Array<{
    name: string;
    filePath: string;
    relativeFilePath: string;
    line: number;
    sequence: BehaviorType[];
    score?: number;
    reasons?: string[];
  }>;
}

export interface GitChangedRange {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface GitDiffSummary {
  changedFiles: string[];
  changedRanges: GitChangedRange[];
}
