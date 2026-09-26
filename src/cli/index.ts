#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { runBehavDiff } from '../index.js';
import { formatTerminalReport, formatJsonReport } from '../reporter/terminal.js';
import type { ConfidenceLevel } from '../types/index.js';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();
const packageVersion = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
) as { version: string };

program
  .name('behavdiff')
  .description('Zero-config behavioral drift detector for TypeScript codebases')
  .version(packageVersion.version);

program
  .command('check [targetPath]', { isDefault: true })
  .description('Check TypeScript code for behavioral drift against comparable established flows')
  .option('--cwd <path>', 'Working directory to analyze')
  .option('--staged', 'Analyze only staged Git changes')
  .option('--base <ref>', 'Compare changes against a base Git ref or branch')
  .option('--all', 'Analyze all functions in repository instead of only Git changes')
  .option('--min-score <number>', 'Minimum similar-flow score (0-100)', '65')
  .option('--min-peers <number>', 'Minimum comparable peers required', '3')
  .option('--min-consensus <number>', 'Minimum baseline consensus ratio (0-1)', '0.75')
  .option('--diagnostics', 'List unclassified calls on injected services in changed functions')
  .option('--config <path>', 'Path to BehavDiff JSON config (defaults to behavdiff.config.json)')
  .option(
    '--min-confidence <level>',
    'Minimum confidence level to report (high, medium, low)',
    'medium',
  )
  .option('--json', 'Output findings in JSON format')
  .action(async (targetPath, options) => {
    try {
      const minConfidence = (options.minConfidence || 'medium').toUpperCase() as ConfidenceLevel;
      if (!['HIGH', 'MEDIUM', 'LOW'].includes(minConfidence)) {
        console.error(pc.red(`Error: Invalid confidence level "${options.minConfidence}". Use high, medium, or low.`));
        process.exit(2);
      }

      const minScore = Number(options.minScore);
      const minPeers = Number(options.minPeers);
      const minConsensusRatio = Number(options.minConsensus);
      if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
        throw new Error('--min-score must be a number between 0 and 100.');
      }
      if (!Number.isInteger(minPeers) || minPeers < 1) {
        throw new Error('--min-peers must be a positive integer.');
      }
      if (!Number.isFinite(minConsensusRatio) || minConsensusRatio < 0 || minConsensusRatio > 1) {
        throw new Error('--min-consensus must be a number between 0 and 1.');
      }

      const cwd = options.cwd || targetPath || process.cwd();
      const resolvedCwd = path.resolve(cwd);
      if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
        throw new Error(`Target directory does not exist: ${resolvedCwd}`);
      }
      const isTargetingFixture = targetPath && targetPath.includes('fixtures');

      const summary = await runBehavDiff({
        cwd: resolvedCwd,
        staged: options.staged,
        baseRef: options.base,
        all: options.all,
        minConfidence,
        minScore,
        minPeers,
        minConsensusRatio,
        diagnostics: options.diagnostics,
        configPath: options.config,
        ignorePatterns: isTargetingFixture ? [] : undefined,
      });

      if (options.json) {
        console.log(formatJsonReport(summary));
      } else {
        console.log(formatTerminalReport(summary));
      }

      if (summary.findings.length > 0) {
        // Exit code 1: significant drift detected
        process.exit(1);
      } else {
        // Exit code 0: clean
        process.exit(0);
      }
    } catch (err: any) {
      console.error(pc.red('BehavDiff Error:'), err?.message || err);
      process.exit(2);
    }
  });

program.parse(process.argv);
