# Publishing BehavDiff

Publishing is intentionally separate from ordinary pushes and CI.

## First publication

At the time this guide was written, the public npm registry returned `404 Not Found` for
`behavdiff`. Confirm the name is still available immediately before publishing.

An npm trusted publisher is configured from an existing package's settings, so establish
the package once from a trusted local machine:

```bash
npm login
npm whoami
npm publish --tag beta --access public --provenance=false
```

The explicit `--provenance=false` applies only to this local bootstrap publication;
provenance requires a supported CI environment. Follow the npm account's current 2FA
requirements and inspect `npm pack --dry-run` immediately before publishing.

## One-time trusted-publisher setup

After the package exists:

1. In the package settings on npmjs.com, add a GitHub Actions trusted publisher.
2. Set the GitHub owner to `mk1shan`, repository to `behavdiff`, and workflow filename to `publish-beta.yml`.
3. Allow direct `npm publish` for that trusted publisher.

The workflow uses npm OIDC trusted publishing, so it does not require a long-lived `NPM_TOKEN`. The repository must be public for npm provenance attestations.

## Publish a beta

1. Confirm `package.json` and `package-lock.json` contain the intended prerelease version.
2. Confirm CI is green on that commit.
3. Create a GitHub prerelease whose tag matches the package version, such as `v0.3.0-beta.1`.
4. The `Publish beta to npm` workflow reruns typecheck, tests, and build, then publishes with the npm `beta` tag.

Do not reuse a version already published to npm. Publishing is irreversible for that version number.

## Local package verification

Before creating the GitHub prerelease:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Install the resulting tarball into a clean temporary TypeScript project and check `behavdiff --version`, `behavdiff --help`, and a small analysis run.
