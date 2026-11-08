# Maintained dependency security backports

The locked dependency tree contains two underlying advisories. npm reports eight affected package entries because it also counts their parents. The dependency versions and audit results are not hidden or renamed.

| Issue | Dependency path | Local repair |
| --- | --- | --- |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), high severity resource exhaustion | Inngest → Zod 3.25.76, imported through `zod/v3` | Reject oversized constrained arrays, sets and fixed tuples before visiting elements or allocating their parse results. |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), low severity prototype poisoning | Jest configuration → deepmerge 4.3.1; development only | Reject reserved prototype-related keys in both copy loops, write own data properties without invoking inherited setters, and reject unsafe proxy checks. |

## Why a version upgrade is insufficient

Zod's [upstream fix](https://github.com/colinhacks/zod/commit/a0ebf97) implements early collection-bound checks in its v4 implementation. Inngest still imports the v3 compatibility implementation. Merely overriding the package to a newer v4 version can remove an audit match while leaving that older implementation's behavior unchanged. This repository instead backports the early-rejection behavior into both v3 JavaScript runtime formats.

The latest published deepmerge release, 4.3.1, has no published advisory fix. Its [upstream issue](https://github.com/TehShrike/deepmerge/issues/273) describes the reserved-key and safe-assignment repair. Downgrading packages to escape a catalog's version range is not a security repair.

## Installation and verification

`npm ci` runs `scripts/patch-security-dependencies.mjs` automatically after installing the locked packages. It validates the exact package versions and SHA-256 hashes for both Zod runtime files and all three published deepmerge JavaScript entry points. Every target is validated before any is written. Already-patched files are accepted only when their hashes match the reviewed outputs. Unknown versions or contents stop with an error requiring review; the script never downloads or executes a replacement from a third-party source.

Next checks the hashes when loading its configuration, including direct CLI invocation with npm lifecycle hooks disabled. The documented test commands check explicitly, and the isolated launcher checks before reading a profile or seeding data. A production-only installation may omit the Jest-only dependency; Zod remains required. An install with scripts disabled must run the patcher explicitly before these commands will work. The patcher supports regular npm directory layouts and rejects linked root, package or nested dependency directories; it does not modify shared package stores.

```bash
npm ci
npm run security:check
npm run test:security
npm test -- --runInBand
npm run lint
npm run build
npm audit --audit-level=moderate
```

The security tests reproduce the original bad behavior in temporary copies and test the repaired code through both module formats. Collection checks cover synchronous/asynchronous parsing, bound issue metadata, nested schemas and valid inputs. Merge checks cover malicious source/target objects and ordinary merges. Installer/startup checks cover altered files, unexpected nested versions, idempotence, production-only installs, symlink targets and direct startup with npm hooks disabled. Tests do not change production services or the installed originals used as the comparison fixtures.

## Limits and maintenance

These are maintained local patches, not official new vendor releases. The ordinary npm audit continues to report the original published versions. Track that output alongside the patch hashes and behavioral regressions; do not describe this as a zero-warning audit.

The Zod backport repairs the early-bound-check failure for constrained collections. The advisory also describes unconstrained arrays; the backport does not invent limits for these schemas. Inngest uses unconstrained schemas, so the serving route separately enforces a structural budget before SDK validation: at most 1,000 children per collection/object, 5,000 total value nodes, and depth 30 (root depth zero). Over-budget input returns HTTP 413. The existing 4 MiB raw-byte cap precedes JSON parsing; malformed JSON/UTF-8 returns HTTP 400, and empty registration bodies remain supported. The SDK receives the original bytes and retains its signature checks. Signed execution, registration, and trust-probe regressions exercise the actual SDK without contacting providers.

This bounds the application entry point's validation work; it does not repair arbitrary unconstrained Zod use elsewhere, eliminate JSON parsing allocations, or prove immunity to every resource-exhaustion attack. Keep request-size limits, signatures, access checks and rate limits. Review the structural budget if future workflows genuinely need larger step state. deepmerge's repair applies to the default implementation; caller-supplied custom merge functions remain the caller's responsibility.

When a compatible upstream release repairs the implementation actually imported by the app, remove the corresponding patch definition and installer requirement, update the lockfile, and run these same regression cases against the unmodified new release. A changed hash should trigger this review rather than be added to an allowlist automatically. Keep the patch files and this document in the public export so a fresh install receives the same repair.
