import { describe, it, expect } from 'vitest';
import { discoverBaselinePattern } from '../../src/baseline/patterns.js';
import type { FunctionFingerprint, SimilarityResult } from '../../src/types/index.js';

describe('Baseline Pattern Discovery', () => {
  const dummyLoc = {
    filePath: '/src/test.ts',
    startLine: 1,
    startColumn: 1,
    endLine: 10,
    endColumn: 1,
  };

  function createPeer(name: string, seq: any[]): SimilarityResult {
    const fp: FunctionFingerprint = {
      id: `id-${name}`,
      name,
      filePath: `/src/${name}.ts`,
      relativeFilePath: `src/${name}.ts`,
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: seq,
      location: dummyLoc,
    };
    return {
      targetFunction: fp,
      peerFunction: fp,
      score: 85,
      breakdown: {
        roleMatchScore: 25,
        namingIntentScore: 25,
        moduleProximityScore: 10,
        entityOverlapScore: 15,
        structuralScore: 10,
        totalScore: 85,
      },
      isEligiblePeer: true,
    };
  }

  const target: FunctionFingerprint = {
    id: 'target-id',
    name: 'createSubscription',
    filePath: '/src/sub.ts',
    relativeFilePath: 'src/sub.ts',
    role: 'nestjs-service-method',
    parameters: [],
    decorators: [],
    injectedDependencies: [],
    targetEntities: [],
    behaviors: [],
    sequence: ['EMAIL', 'DB_WRITE'],
    location: dummyLoc,
  };

  it('declares baseline pattern when 3/3 peers share identical sequence', () => {
    const peers = [
      createPeer('createOrder', ['VALIDATION', 'DB_WRITE', 'EMAIL']),
      createPeer('createBooking', ['VALIDATION', 'DB_WRITE', 'EMAIL']),
      createPeer('createInvoice', ['VALIDATION', 'DB_WRITE', 'EMAIL']),
    ];

    const baseline = discoverBaselinePattern(target, peers);
    expect(baseline).not.toBeNull();
    expect(baseline?.dominantSequence).toEqual(['VALIDATION', 'DB_WRITE', 'EMAIL']);
    expect(baseline?.peerCount).toBe(3);
    expect(baseline?.totalCandidates).toBe(3);
    expect(baseline?.consensusRatio).toBe(1.0);
  });

  it('rejects baseline if peer count is less than 3', () => {
    const peers = [
      createPeer('createOrder', ['VALIDATION', 'DB_WRITE', 'EMAIL']),
      createPeer('createBooking', ['VALIDATION', 'DB_WRITE', 'EMAIL']),
    ];

    const baseline = discoverBaselinePattern(target, peers);
    expect(baseline).toBeNull();
  });

  it('rejects baseline if consensus ratio is below 75%', () => {
    const peers = [
      createPeer('createA', ['VALIDATION', 'DB_WRITE']),
      createPeer('createB', ['DB_WRITE', 'EMAIL']),
      createPeer('createC', ['VALIDATION', 'EMAIL']),
      createPeer('createD', ['VALIDATION', 'DB_WRITE']),
    ]; // 2/4 = 50% consensus

    const baseline = discoverBaselinePattern(target, peers);
    expect(baseline).toBeNull();
  });

  it('treats adjacent repeated operations as one behavior phase', () => {
    const readTarget = { ...target, name: 'findTags', sequence: ['DB_WRITE', 'DB_READ'] as any[] };
    const peers = [
      createPeer('findUsers', ['DB_READ']),
      createPeer('findProfiles', ['DB_READ', 'DB_READ']),
      createPeer('findArticles', ['DB_READ', 'DB_READ', 'DB_READ']),
    ];

    const baseline = discoverBaselinePattern(readTarget, peers);

    expect(baseline?.dominantSequence).toEqual(['DB_READ']);
    expect(baseline?.consensusRatio).toBe(1);
    expect(baseline?.peers[1].sequence).toEqual(['DB_READ', 'DB_READ']);
  });
});
