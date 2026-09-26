import fs from 'node:fs';
import path from 'node:path';
import type { BehaviorType } from './types/index.js';

const behaviorTypes: BehaviorType[] = [
  'AUTH', 'VALIDATION', 'DB_READ', 'DB_WRITE', 'HTTP_CALL', 'EMAIL', 'PAYMENT',
  'QUEUE', 'CACHE_READ', 'CACHE_WRITE', 'TRANSACTION_BEGIN', 'TRANSACTION_END',
  'UNKNOWN_EXTERNAL_EFFECT',
];

export type CustomBehaviorMappings = Partial<Record<BehaviorType, string[]>>;

export interface BehavDiffConfig {
  behaviors?: CustomBehaviorMappings;
}

export function loadBehavDiffConfig(cwd: string, configPath?: string): BehavDiffConfig {
  const filePath = configPath
    ? path.resolve(cwd, configPath)
    : path.join(cwd, 'behavdiff.config.json');

  if (!fs.existsSync(filePath)) {
    if (configPath) throw new Error(`BehavDiff config file not found: ${filePath}`);
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid BehavDiff config JSON at ${filePath}: ${detail}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('BehavDiff config must be a JSON object.');
  }
  const behaviors = (parsed as Record<string, unknown>).behaviors;
  if (behaviors === undefined) return {};
  if (!behaviors || typeof behaviors !== 'object' || Array.isArray(behaviors)) {
    throw new Error('BehavDiff config "behaviors" must be an object of behavior names to call patterns.');
  }

  const result: CustomBehaviorMappings = {};
  for (const [behavior, patterns] of Object.entries(behaviors)) {
    if (!behaviorTypes.includes(behavior as BehaviorType)) {
      throw new Error(`Unknown behavior "${behavior}" in BehavDiff config.`);
    }
    if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== 'string' || !pattern.trim())) {
      throw new Error(`Patterns for "${behavior}" must be an array of non-empty strings.`);
    }
    result[behavior as BehaviorType] = patterns as string[];
  }
  return { behaviors: result };
}

export function matchCustomBehavior(
  callee: string,
  mappings: CustomBehaviorMappings = {},
): BehaviorType | undefined {
  const normalizedCallee = callee.replace(/^this\./, '');
  for (const [behavior, patterns] of Object.entries(mappings)) {
    if (patterns?.some((pattern) =>
      wildcardMatch(pattern.trim().replace(/^this\./, ''), normalizedCallee),
    )) {
      return behavior as BehaviorType;
    }
  }
  return undefined;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.trim().split('*').map(escapeRegExp).join('.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
