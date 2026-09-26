import path from 'node:path';
import type {
  FunctionFingerprint,
  SimilarityBreakdown,
  SimilarityResult,
} from '../types/index.js';

export type IntentCategory = 'CREATE' | 'UPDATE' | 'DELETE' | 'READ' | 'OTHER';

const INTENT_MAP: Record<string, IntentCategory> = {
  create: 'CREATE',
  register: 'CREATE',
  add: 'CREATE',
  insert: 'CREATE',
  new: 'CREATE',
  signup: 'CREATE',
  book: 'CREATE',
  booking: 'CREATE',
  checkout: 'CREATE',
  subscribe: 'CREATE',
  subscription: 'CREATE',
  setup: 'CREATE',

  update: 'UPDATE',
  modify: 'UPDATE',
  patch: 'UPDATE',
  change: 'UPDATE',
  set: 'UPDATE',
  edit: 'UPDATE',
  renew: 'UPDATE',

  delete: 'DELETE',
  remove: 'DELETE',
  cancel: 'DELETE',
  archive: 'DELETE',
  destroy: 'DELETE',

  get: 'READ',
  find: 'READ',
  fetch: 'READ',
  load: 'READ',
  list: 'READ',
  search: 'READ',
  query: 'READ',
};

export function extractIntent(functionName: string): IntentCategory {
  const tokens = functionName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return 'OTHER';

  for (const token of tokens) {
    if (INTENT_MAP[token]) {
      return INTENT_MAP[token];
    }
  }

  return 'OTHER';
}

export function computeSimilarity(
  target: FunctionFingerprint,
  peer: FunctionFingerprint,
): SimilarityResult {
  // 1. Hard Disqualifiers
  if (target.id === peer.id) {
    return createDisqualifiedResult(target, peer, 'Self comparison');
  }

  // Trivial check: both functions must have at least one behavior
  if (target.behaviors.length === 0) {
    return createDisqualifiedResult(target, peer, 'Target function has no behaviors');
  }
  if (peer.behaviors.length === 0) {
    return createDisqualifiedResult(target, peer, 'Peer function has no behaviors');
  }

  // Role compatibility is a hard gate: score points must never allow a controller
  // to become evidence for a service or utility function.
  const targetRoleGroup = roleGroup(target.role);
  const peerRoleGroup = roleGroup(peer.role);
  if (targetRoleGroup !== peerRoleGroup) {
    return createDisqualifiedResult(
      target,
      peer,
      `Incompatible framework roles (${target.role} vs ${peer.role})`,
    );
  }

  // HTTP Verb mismatch if both have defined verbs
  if (target.httpMethod && peer.httpMethod && target.httpMethod !== peer.httpMethod) {
    return createDisqualifiedResult(
      target,
      peer,
      `HTTP verb mismatch (${target.httpMethod} vs ${peer.httpMethod})`,
    );
  }

  const targetIntent = extractIntent(target.name);
  const peerIntent = extractIntent(peer.name);

  // Intent match requirement: comparable flows must share the same non-OTHER intent
  if (targetIntent === 'OTHER' || peerIntent === 'OTHER') {
    return createDisqualifiedResult(
      target,
      peer,
      `Unclassified intent category (target: ${targetIntent}, peer: ${peerIntent})`,
    );
  }
  if (targetIntent !== peerIntent) {
    return createDisqualifiedResult(
      target,
      peer,
      `Intent category mismatch (${targetIntent} vs ${peerIntent})`,
    );
  }

  // 2. Intent Score (Max: 25)
  // Reaching here guarantees targetIntent === peerIntent and neither is OTHER
  const namingIntentScore = 25;

  // 3. Role Match Score (Max: 25)
  let roleMatchScore = 0;
  const selectionReasons: string[] = [`same intent (${targetIntent})`];
  if (target.role === peer.role) {
    roleMatchScore = 25;
    selectionReasons.push(`same role (${target.role})`);
  } else {
    roleMatchScore = 20;
    selectionReasons.push(`same role group (${targetRoleGroup})`);
  }

  // 4. Entity & Dependency Overlap Score (Max: 20)
  let entityOverlapScore = 0;
  const sharedEntities = target.targetEntities.filter((e) =>
    peer.targetEntities.includes(e),
  );
  const sharedDeps = target.injectedDependencies.filter((d) =>
    peer.injectedDependencies.includes(d),
  );

  if (sharedEntities.length > 0) {
    entityOverlapScore = 20;
    selectionReasons.push('shared entity');
  } else if (sharedDeps.length > 0) {
    entityOverlapScore = 15;
    selectionReasons.push('shared injected dependency');
  } else if (
    target.sequence.some((s) => s.startsWith('DB_')) &&
    peer.sequence.some((s) => s.startsWith('DB_'))
  ) {
    entityOverlapScore = 10;
    selectionReasons.push('both flows include a database operation');
  }

  // 5. Module Proximity Score (Max: 15)
  let moduleProximityScore = 0;
  const targetDir = path.dirname(target.relativeFilePath).replace(/\\/g, '/');
  const peerDir = path.dirname(peer.relativeFilePath).replace(/\\/g, '/');

  if (targetDir === peerDir) {
    moduleProximityScore = 15;
    selectionReasons.push('same directory');
  } else {
    const targetParent = path.dirname(targetDir);
    const peerParent = path.dirname(peerDir);
    if (targetParent === peerParent && targetParent !== '.') {
      moduleProximityScore = 10;
      selectionReasons.push('neighboring feature directories');
    } else if (target.relativeFilePath.split('/')[0] === peer.relativeFilePath.split('/')[0]) {
      moduleProximityScore = 5;
      selectionReasons.push('same source area');
    }
  }

  // 6. Structural & Signature Score (Max: 15)
  let structuralScore = 0;
  if (target.parameters.length === peer.parameters.length) {
    structuralScore += 8;
    selectionReasons.push('same parameter count');
  }
  const targetHasDto = target.parameters.some((p) => p.isDtoLike);
  const peerHasDto = peer.parameters.some((p) => p.isDtoLike);
  if (targetHasDto === peerHasDto) {
    structuralScore += 7;
    selectionReasons.push('same DTO-like parameter shape');
  }

  const totalScore =
    roleMatchScore +
    namingIntentScore +
    entityOverlapScore +
    moduleProximityScore +
    structuralScore;

  const isEligiblePeer = totalScore >= 65;

  return {
    targetFunction: target,
    peerFunction: peer,
    score: totalScore,
    breakdown: {
      roleMatchScore,
      namingIntentScore,
      moduleProximityScore,
      entityOverlapScore,
      structuralScore,
      totalScore,
    },
    isEligiblePeer,
    rejectionReason: isEligiblePeer ? undefined : `Score ${totalScore} below threshold 65`,
    selectionReasons,
  };
}

function createDisqualifiedResult(
  target: FunctionFingerprint,
  peer: FunctionFingerprint,
  reason: string,
): SimilarityResult {
  return {
    targetFunction: target,
    peerFunction: peer,
    score: 0,
    breakdown: {
      roleMatchScore: 0,
      namingIntentScore: 0,
      moduleProximityScore: 0,
      entityOverlapScore: 0,
      structuralScore: 0,
      totalScore: 0,
    },
    isEligiblePeer: false,
    rejectionReason: reason,
    selectionReasons: [],
  };
}

function roleGroup(role: FunctionFingerprint['role']): string {
  if (role.includes('service')) return 'service';
  if (role.includes('controller') || role === 'express-route-handler') return 'controller';
  if (role === 'standalone-function') return 'standalone';
  return 'unknown';
}
