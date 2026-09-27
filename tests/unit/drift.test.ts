import { describe, it, expect } from 'vitest';
import { compareBehaviorToBaseline } from '../../src/drift/comparator.js';
import type { BaselinePattern, FunctionFingerprint } from '../../src/types/index.js';

describe('Drift Comparator & Finding Generation', () => {
  const dummyLoc = {
    filePath: '/src/sub.service.ts',
    startLine: 10,
    startColumn: 1,
    endLine: 25,
    endColumn: 1,
  };

  const baseline: BaselinePattern = {
    role: 'nestjs-service-method',
    intentCluster: 'CREATE',
    dominantSequence: ['VALIDATION', 'DB_WRITE', 'EMAIL'],
    peers: [],
    peerCount: 3,
    totalCandidates: 3,
    consensusRatio: 1.0,
  };

  it('detects missing VALIDATION and reordered EMAIL in createSubscription', () => {
    const target: FunctionFingerprint = {
      id: 'sub-id',
      name: 'createSubscription',
      filePath: '/src/sub.service.ts',
      relativeFilePath: 'src/sub.service.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: ['EMAIL', 'DB_WRITE'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, baseline);
    expect(finding).not.toBeNull();
    expect(finding?.confidence).toBe('HIGH');

    const diffTypes = finding?.differences.map((d) => d.type);
    expect(diffTypes).toContain('MISSING_BEHAVIOR');
    expect(diffTypes).toContain('REORDERED_BEHAVIOR');

    const missingVal = finding?.differences.find((d) => d.affectedBehavior === 'VALIDATION');
    expect(missingVal?.description).toContain('VALIDATION step not observed');

    const reorderedEmail = finding?.differences.find((d) => d.affectedBehavior === 'EMAIL');
    expect(reorderedEmail?.description).toContain('EMAIL now occurs before DB_WRITE');
  });

  it('detects added behavior when a new step is introduced', () => {
    const target: FunctionFingerprint = {
      id: 'target-added',
      name: 'createOrder',
      filePath: '/src/order.ts',
      relativeFilePath: 'src/order.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: ['VALIDATION', 'DB_WRITE', 'EMAIL', 'CACHE_WRITE'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, baseline);
    expect(finding).not.toBeNull();

    const added = finding?.differences.find((d) => d.type === 'ADDED_BEHAVIOR');
    expect(added?.affectedBehavior).toBe('CACHE_WRITE');
  });

  it('detects new external network effect before DB persistence', () => {
    const target: FunctionFingerprint = {
      id: 'target-ext',
      name: 'createOrder',
      filePath: '/src/order.ts',
      relativeFilePath: 'src/order.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: ['HTTP_CALL', 'VALIDATION', 'DB_WRITE', 'EMAIL'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, baseline);
    expect(finding).not.toBeNull();

    const extDiff = finding?.differences.find((d) => d.type === 'NEW_EXTERNAL_EFFECT');
    expect(extDiff).toBeDefined();
    expect(extDiff?.affectedBehavior).toBe('HTTP_CALL');
  });

  it('returns null when sequence conforms perfectly to baseline', () => {
    const target: FunctionFingerprint = {
      id: 'target-clean',
      name: 'createOrder',
      filePath: '/src/order.ts',
      relativeFilePath: 'src/order.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: ['VALIDATION', 'DB_WRITE', 'EMAIL'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, baseline);
    expect(finding).toBeNull();
  });

  it('detects missing duplicate behavior occurrences', () => {
    const duplicateBaseline: BaselinePattern = {
      ...baseline,
      dominantSequence: ['DB_WRITE', 'DB_WRITE', 'EMAIL'],
    };
    const target: FunctionFingerprint = {
      id: 'target-duplicate',
      name: 'createOrder',
      filePath: '/src/order.ts',
      relativeFilePath: 'src/order.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: [],
      targetEntities: [],
      behaviors: [],
      sequence: ['DB_WRITE', 'EMAIL'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, duplicateBaseline);
    expect(finding?.differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'MISSING_BEHAVIOR',
          affectedBehavior: 'DB_WRITE',
        }),
      ]),
    );
  });

  it('reports a database write introduced into a read flow at default confidence', () => {
    const readBaseline: BaselinePattern = {
      ...baseline,
      intentCluster: 'READ',
      dominantSequence: ['DB_READ'],
      peerCount: 7,
      totalCandidates: 10,
      consensusRatio: 1,
    };
    const target: FunctionFingerprint = {
      id: 'find-tags',
      name: 'findAll',
      filePath: '/src/tag.service.ts',
      relativeFilePath: 'src/tag.service.ts',
      role: 'nestjs-service-method',
      parameters: [],
      decorators: [],
      injectedDependencies: ['tagRepository'],
      targetEntities: ['tag'],
      behaviors: [],
      sequence: ['DB_WRITE', 'DB_READ'],
      location: dummyLoc,
    };

    const finding = compareBehaviorToBaseline(target, readBaseline);

    expect(finding?.confidence).toBe('MEDIUM');
    expect(finding?.differences).toContainEqual(
      expect.objectContaining({
        type: 'ADDED_BEHAVIOR',
        affectedBehavior: 'DB_WRITE',
      }),
    );
  });
});
