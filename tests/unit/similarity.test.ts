import { describe, it, expect } from 'vitest';
import { extractIntent, computeSimilarity } from '../../src/similarity/scoring.js';
import { findSimilarFlows } from '../../src/similarity/matcher.js';
import type { FunctionFingerprint } from '../../src/types/index.js';

describe('Similarity Scoring & Flow Matching', () => {
  it('extracts intent categories correctly', () => {
    expect(extractIntent('createOrder')).toBe('CREATE');
    expect(extractIntent('registerUser')).toBe('CREATE');
    expect(extractIntent('addBooking')).toBe('CREATE');
    expect(extractIntent('updateProfile')).toBe('UPDATE');
    expect(extractIntent('deleteItem')).toBe('DELETE');
    expect(extractIntent('cancelSubscription')).toBe('DELETE');
    expect(extractIntent('getOrder')).toBe('READ');
    expect(extractIntent('findUserById')).toBe('READ');
  });

  const dummyLoc = {
    filePath: '/src/order.service.ts',
    startLine: 10,
    startColumn: 1,
    endLine: 20,
    endColumn: 1,
  };

  const createOrderFp: FunctionFingerprint = {
    id: 'src/orders/order.service.ts::OrderService::createOrder::10',
    name: 'createOrder',
    filePath: '/src/orders/order.service.ts',
    relativeFilePath: 'src/orders/order.service.ts',
    role: 'nestjs-service-method',
    parameters: [{ name: 'dto', isDtoLike: true }],
    decorators: [],
    injectedDependencies: ['PrismaService', 'MailerService'],
    targetEntities: ['order'],
    behaviors: [
      { id: '1', type: 'VALIDATION', label: 'val', location: dummyLoc, isAwaited: false, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'val', rawCallee: 'val' },
      { id: '2', type: 'DB_WRITE', label: 'db', location: dummyLoc, isAwaited: true, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'db', rawCallee: 'db' },
      { id: '3', type: 'EMAIL', label: 'email', location: dummyLoc, isAwaited: true, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'email', rawCallee: 'email' },
    ],
    sequence: ['VALIDATION', 'DB_WRITE', 'EMAIL'],
    location: dummyLoc,
  };

  const createBookingFp: FunctionFingerprint = {
    id: 'src/bookings/booking.service.ts::BookingService::createBooking::10',
    name: 'createBooking',
    filePath: '/src/bookings/booking.service.ts',
    relativeFilePath: 'src/bookings/booking.service.ts',
    role: 'nestjs-service-method',
    parameters: [{ name: 'dto', isDtoLike: true }],
    decorators: [],
    injectedDependencies: ['PrismaService', 'MailerService'],
    targetEntities: ['booking'],
    behaviors: [
      { id: '4', type: 'VALIDATION', label: 'val', location: dummyLoc, isAwaited: false, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'val', rawCallee: 'val' },
      { id: '5', type: 'DB_WRITE', label: 'db', location: dummyLoc, isAwaited: true, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'db', rawCallee: 'db' },
      { id: '6', type: 'EMAIL', label: 'email', location: dummyLoc, isAwaited: true, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'email', rawCallee: 'email' },
    ],
    sequence: ['VALIDATION', 'DB_WRITE', 'EMAIL'],
    location: dummyLoc,
  };

  const getUserFp: FunctionFingerprint = {
    id: 'src/users/user.service.ts::UserService::getUser::10',
    name: 'getUser',
    filePath: '/src/users/user.service.ts',
    relativeFilePath: 'src/users/user.service.ts',
    role: 'nestjs-service-method',
    parameters: [{ name: 'id', isDtoLike: false }],
    decorators: [],
    injectedDependencies: ['PrismaService'],
    targetEntities: ['user'],
    behaviors: [
      { id: '7', type: 'DB_READ', label: 'read', location: dummyLoc, isAwaited: true, isConditional: false, isGuardedByTryCatch: false, adapterSource: 'db', rawCallee: 'db' },
    ],
    sequence: ['DB_READ'],
    location: dummyLoc,
  };

  it('rates similar creation flows as eligible with high score', () => {
    const res = computeSimilarity(createOrderFp, createBookingFp);
    expect(res.isEligiblePeer).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(65);
    expect(res.breakdown.namingIntentScore).toBe(25);
    expect(res.breakdown.roleMatchScore).toBe(25);
  });

  it('disqualifies comparison between CREATE mutation and READ query', () => {
    const res = computeSimilarity(createOrderFp, getUserFp);
    expect(res.isEligiblePeer).toBe(false);
    expect(res.score).toBe(0);
    expect(res.rejectionReason).toContain('Intent category mismatch');
  });

  it('disqualifies self-comparison', () => {
    const res = computeSimilarity(createOrderFp, createOrderFp);
    expect(res.isEligiblePeer).toBe(false);
    expect(res.rejectionReason).toBe('Self comparison');
  });

  it('selects eligible peers and filters out disqualified functions', () => {
    const peers = findSimilarFlows(createOrderFp, [createBookingFp, getUserFp]);
    expect(peers.length).toBe(1);
    expect(peers[0].peerFunction.name).toBe('createBooking');
  });
});
