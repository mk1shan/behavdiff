# Changelog

All notable changes to BehavDiff are documented here.

## 0.3.0-beta.1

- Add identity-aware TypeORM repository and QueryBuilder behavior recognition.
- Normalize adjacent repeated behavior phases when learning repository baselines.
- Add normal-output coverage reporting and mark clean results with no comparable peers as inconclusive.
- Keep detailed unknown-call locations behind `--diagnostics` while showing the count by default.
- Add real-framework fixtures for TypeORM, Prisma, NestJS, and false-positive prevention.
- Clarify Git behavior, supported call shapes, thresholds, and static-analysis limitations.

## 0.2.0

- Initial public package structure and CLI.
- Add TypeScript AST extraction, repository-learned baselines, Git change mapping, confidence scoring, custom behavior mappings, and terminal/JSON reports.
