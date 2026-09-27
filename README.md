# BehavDiff

> **Zero-config behavioral drift detector for AI-assisted TypeScript codebases.**

[![npm version](https://img.shields.io/npm/v/behavdiff.svg)](https://www.npmjs.com/package/behavdiff)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Modern developers increasingly build software with AI coding agents (such as Cursor, Claude Code, GitHub Copilot, Codex). While these tools write working code quickly, new or modified functions can **silently behave differently from established application flows** in your repository.

Existing developer tools catch compiler errors, lint violations, formatting issues, and duplicate code. **BehavDiff solves a different problem:**

> **"Does this new code behave differently from comparable code already in this application?"**

---

## 🔒 Privacy First

> **Your source code never leaves your machine.**

- **100% Local Execution**: Runs entirely on your workstation or CI server.
- **No LLM or Cloud Required**: No OpenAI, Anthropic, Gemini, or remote servers.
- **No Database or Accounts**: Zero setup, zero accounts, zero telemetry.
- **Deterministic for the same inputs**: The same source, configuration, BehavDiff version, and dependency metadata produce the same AST-based result.

---

## 💡 The Core Example

Suppose your existing application contains established creation flows:

```typescript
// src/orders/order.service.ts
async createOrder(data) {
  this.validateOrder(data);
  await this.prisma.order.create({ data });
  await this.mailService.sendConfirmation(data.email);
}
// Sequence: VALIDATION → DB_WRITE → EMAIL

// src/bookings/booking.service.ts
async createBooking(data) {
  this.validateBooking(data);
  await this.prisma.booking.create({ data });
  await this.mailService.sendConfirmation(data.email);
}
// Sequence: VALIDATION → DB_WRITE → EMAIL

// src/invoices/invoice.service.ts
async createInvoice(data) {
  this.validateInvoice(data);
  await this.prisma.invoice.create({ data });
  await this.mailService.sendConfirmation(data.email);
}
// Sequence: VALIDATION → DB_WRITE → EMAIL
```

An AI agent or developer writes a new function:

```typescript
// src/subscriptions/subscription.service.ts
async createSubscription(data) {
  await this.mailService.sendConfirmation(data.email);
  await this.prisma.subscription.create({ data });
}
// Sequence: EMAIL → DB_WRITE
```

Running `npx behavdiff check` outputs:

```text
BehavDiff — Behavioral Drift Detector

  ✓ 142 functions indexed
  ✓ 19 comparable flows discovered
  ✓ 1 changed function analyzed

Behavior coverage:
  2 recognized behavior events across 1/1 target functions
  0 unclassified injected-service calls
  1/1 target functions have comparable peers

⚠ 1 BEHAVIORAL DRIFT FINDING DETECTED

src/subscriptions/subscription.service.ts:4
createSubscription()

Common behavior:
  VALIDATION → DB_WRITE → EMAIL

New behavior:
  EMAIL → DB_WRITE

Differences:
  • VALIDATION step not observed
  • EMAIL now occurs before DB_WRITE

Compared against:
  • createBooking() (src/bookings/booking.service.ts:4)
  • createInvoice() (src/invoices/invoice.service.ts:4)
  • createOrder() (src/orders/order.service.ts:4)

Evidence:
  3/3 (100%) comparable create flows follow the common sequence.

Confidence: HIGH

Review recommended.
```

BehavDiff **does not** claim unusual code is automatically a bug. It surfaces empirical behavioral differences with evidence so you can review them with confidence.

---

## 🚀 Quick Start

### 1. Installation

Install as a development dependency:

```bash
npm install -D behavdiff
# or
pnpm add -D behavdiff
# or
yarn add -D behavdiff
```

### 2. Run Locally

Analyze your current Git changes against comparable established flows:

```bash
npx behavdiff check
```

Changed-code mode requires Git and an existing commit. By default, BehavDiff compares
the working tree with `HEAD` and also includes untracked TypeScript files. If the target
is not a Git repository or Git is unavailable, BehavDiff falls back to analyzing all
functions. Use `--all` when you intentionally want a full-repository scan.

---

## 🛠 Command Line Interface (CLI)

```bash
npx behavdiff check [options]
```

### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--staged` | Analyze only staged Git changes (`git diff --staged`) | `false` |
| `--base <branch>` | Analyze committed changes from the merge base with a Git ref through `HEAD` (e.g. `origin/main`) | Not set; working tree is compared with `HEAD` |
| `--all` | Analyze all functions in repository instead of only Git changes | `false` |
| `--min-confidence <level>` | Minimum confidence level to report (`high`, `medium`, `low`) | `medium` |
| `--min-score <number>` | Minimum similarity score required for a comparable flow | `65` |
| `--min-peers <number>` | Minimum number of comparable peers required for a baseline | `3` |
| `--min-consensus <number>` | Minimum dominant-sequence consensus ratio from `0` to `1` | `0.75` |
| `--diagnostics` | List unclassified calls on injected services in changed functions | `false` |
| `--config <path>` | Read a BehavDiff JSON config (default: `behavdiff.config.json`) | auto |
| `--json` | Output findings as machine-readable JSON | `false` |
| `-h, --help` | Display help for command | |

### Predictable Exit Codes

BehavDiff conforms to standard CI/CD exit codes:
- **`0`**: No significant behavioral drift detected.
- **`1`**: One or more findings met the selected `--min-confidence` threshold.
- **`2`**: Tool, configuration, or runtime error.

### Custom behavior mappings and diagnostics

BehavDiff automatically reads `behavdiff.config.json` from the project root when the file exists. Use it to classify calls in your own services:

```json
{
  "behaviors": {
    "CACHE_WRITE": ["cacheService.set", "redisClient.set"],
    "QUEUE": ["eventBus.publish"]
  }
}
```

Patterns match call names exactly; `*` can match any text. A leading `this.` is optional, so `cacheService.set` also matches `this.cacheService.set`. Supported labels are validated by BehavDiff and exported by its TypeScript API, including `DB_WRITE`, `CACHE_READ`, `CACHE_WRITE`, `EMAIL`, and `QUEUE`.

To see unclassified calls on injected services in changed functions, run:

```bash
npx behavdiff check --diagnostics
```

The diagnostic list is informational and does not create drift findings. Configure calls that represent important behavior to include them in the sequence analysis. Diagnostics only count calls that BehavDiff can identify as calls on constructor-injected dependencies. Dynamic dispatch, factory-created clients, local variables, unresolved symbols, and other call shapes can remain invisible to both behavior extraction and diagnostics.

Normal terminal output includes a compact behavior-coverage summary: recognized events,
unclassified injected-service calls, and how many target functions have comparable peers.
When no target function has comparable peers, BehavDiff marks a clean result as
inconclusive instead of presenting it as strong evidence that no drift exists. Use
`--diagnostics` to print the locations of unclassified calls.

---

## 🤖 CI/CD Integration

### GitHub Actions Workflow

Add `.github/workflows/behavdiff.yml`:

```yaml
name: Behavioral Drift Check

on:
  pull_request:
    branches: [main, master]

jobs:
  behavdiff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history for git diff comparison

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npx behavdiff check --base origin/main
```

---

## 🧠 How It Works

```
SOURCE CODE
     ↓
AST PARSER (ts-morph)
     ↓
FUNCTION EXTRACTION (Controllers, Services, Handlers)
     ↓
BEHAVIOR EXTRACTOR (Prisma, TypeORM, Validation, Email, HTTP, Payment)
     ↓
BEHAVIOR FINGERPRINTS (Preserved execution ordering)
     ↓
SIMILAR FLOW MATCHER (Hard gating + intent/role/entity scoring)
     ↓
BASELINE PATTERN DISCOVERY (Consensus threshold ≥ 75%, sample ≥ 3)
     ↓
GIT DIFF ANALYSIS (Unified diff hunk mapping to AST nodes)
     ↓
BEHAVIOR COMPARATOR (Missing, added, reordered side effects)
     ↓
TERMINAL & JSON REPORTER
```

### 4 Types of Detected Drift

1. **Missing Behavior**: A critical step observed in consensus flows (such as `VALIDATION` or `AUTH`) is absent.
2. **Reordered Behavior**: Steps are inverted compared to the dominant sequence (e.g., `EMAIL` sent before `DB_WRITE`).
3. **Added Behavior**: An unexpected new side effect is introduced into a standard flow.
4. **New External Effect**: Network/external side effects (`EMAIL`, `HTTP_CALL`, `PAYMENT`, `QUEUE`) occur prior to database persistence.

---

## 🛡 False-Positive Prevention

False positives erode developer trust. BehavDiff enforces strict prevention rules:

- **The Rule of Three**: If fewer than 3 comparable peers exist in the repository, warnings are suppressed.
- **The Consensus Floor**: If existing peers vary widely in their implementations (consensus $< 75\%$), no convention is declared.
- **Intent Gating**: Read queries (`GET`, `find*`, `get*`) are never compared with mutations (`POST`, `create*`, `delete*`).
- **Framework Role Separation**: Service methods, controller handlers, and standalone functions are kept in separate peer groups.
- **Peer Evidence**: Findings show the selected peers, their similarity scores, and the reasons they matched.
- **Exclusion Filters**: Tests (`*.spec.ts`, `*.test.ts`, `__tests__`) and common generated folders (`dist/`, `build/`, `coverage/`) are excluded by default. Other mocks or generated paths require the API's ignore-pattern option.

---

## 📦 Supported Frameworks & Adapters (V1)

- **TypeScript / Node.js**: Functions, classes, async/await, try/catch, statements.
- **Prisma ORM**: `DB_READ` (`findUnique`, `findMany`), `DB_WRITE` (`create`, `update`, `delete`), transactions.
- **TypeORM**: Common reads and writes on typed `Repository`, `TreeRepository`, and `MongoRepository` instances or `@InjectRepository` parameters; common QueryBuilder terminal reads and `execute()` writes.
- **NestJS**: `@UseGuards` (`AUTH`), `@UsePipes` (`VALIDATION`), `@Get`, `@Post`, `@Put`, `@Delete`.
- **Validation**: Zod (`.parse`, `.safeParse`), Class-Validator (`validate`, `validateOrReject`), Joi/Yup, and `validate*` methods.
- **Email**: Direct `sendEmail`/`sendMail` calls and common mail/email service, Nodemailer transporter, Resend, and `sgMail` call shapes (`EMAIL`).
- **HTTP**: `fetch`, Axios, NestJS `HttpService` (`HTTP_CALL`).
- **Payments & Queues**: Stripe, PayPal, Bull, Kafka, RabbitMQ, SQS.

### Current analysis boundaries

BehavDiff is a static heuristic analyzer, not a proof system. It recognizes supported direct call shapes and follows symbol-resolvable local helper calls while preventing recursive cycles. Dynamic dispatch, runtime-generated methods, callbacks whose execution order differs at runtime, external implementations, unresolved symbols, and unsupported libraries may not be classified. Diagnostics are intentionally incomplete for call shapes that cannot be tied to injected dependencies.

Baseline learning also requires evidence: at least three eligible peers, at least 75% normalized-sequence consensus, and medium confidence by default. BehavDiff can therefore suppress a real difference when a repository has too few comparable functions or intentionally diverse workflows. The coverage summary shows recognized events, unclassified injected-service calls, and comparable target functions so a clean result is not presented without context. Findings are review signals rather than proof of a defect; thresholds can be tuned for a repository, but lowering them can increase noise.

---

## 📄 License

MIT © BehavDiff Contributors
