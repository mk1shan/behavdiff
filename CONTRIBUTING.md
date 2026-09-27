# Contributing to BehavDiff

Thank you for helping improve BehavDiff.

## Development

Use Node.js 20, 22, or 24 and install dependencies with:

```bash
npm ci
```

Before submitting a change, run:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Adapter changes

Adapters should use imports, types, decorators, or resolved symbols when possible. Avoid classifying a call from a common method name such as `save` alone. Add a positive test for the supported library and a negative test proving that an unrelated object is not classified.

## Issues and pull requests

Describe the concrete call shape or repository pattern, expected behavior token, actual output, BehavDiff version, Node.js version, and a minimal example that contains no secrets or proprietary source.
