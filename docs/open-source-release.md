# Open-source release checklist

This checklist distinguishes a prepared source snapshot from a published release. Creating an export does not satisfy the verification gates or change production access rules.

## Scope

Release code and public setup documentation under the existing MIT license. The owner selected a code-only release. Exclude original branding, photos, illustrations, videos, sample books, unpublished blog posts, and course chapters. Neutral generated SVG placeholders replace local marketing images. Course landing-page and blog feature code remain examples; the owner's course and blog drafts do not ship.

The export changes visible app and email branding to `Storybook Starter` and replaces the original social profile destinations with reserved `example.com` links. It preserves license attribution, internal application IDs, table names, and configured reference-artwork paths. The private application's branding is unchanged.

## Gates before publication

- Apply and verify production database and storage access protections. Test anonymous and ordinary-user access using synthetic records. Verify guest upload, preview, checkout, approval, and administrator flows still work. Writing a migration is not applying it; if a live SQL connection is unavailable, production remediation remains blocked until it can be applied and verified.
- Confirm historically exposed credentials are revoked and replaced; keep operational rotation records private.
- Run tests, TypeScript checks, production build, and dependency audit on the final source. Resolve findings or document reviewed exceptions.
- Review exported files and run a secret scanner such as Gitleaks on the exported directory. Excluding environment files is not a substitute for scanning source.
- Install, check, and view the exported app using a separate test environment. Verify placeholders and documentation links. Supply your own reference illustrations and PDF template to test fulfillment.
- Enable private vulnerability reporting, secret scanning where available, and dependency alerts on the destination repository.
- Review license notices and announcement links. Publish the blog announcement only after the destination is available and verified.

## Verification status — November 7, 2026

Live database checks confirmed that anonymous direct requests to ten private customer tables return `401`, and the service-only shared rate-limit function responds successfully. These checks verify the database protections that were exercised. They do not establish that this branch's application changes are deployed, that all storage download/signing paths work, or that a complete customer order succeeds. Deploy and verify the application changes separately, using synthetic records and test services where possible.

The source and code-only export pass 216 application tests in 26 suites, 73 dependency repair/startup checks, eight isolated setup/export checks, TypeScript validation, and an exported production build after a clean locked install. The export passes Gitleaks, renders neutral artwork and presentation in the browser, and opens its creation form. Its manifest records the exact content hashes; the original private history and destination placeholder remain untouched.

A dedicated Supabase test project and claimed Stripe Sandbox were exercised through signed upload, verification, preview generation, a real test-card Checkout payment and forwarded webhook, all eleven story images, PDF storage and signed download, captured preview email, approval, and simulated print creation. Invalid tokens and anonymous public PDF downloads were denied. Repeating approval did not create another simulated print. Paid AI, PDF rendering, email delivery and printing were fixture responses; this checks application wiring, not production image quality, print layout, message delivery or fulfillment. See [isolated testing](isolated-testing.md). The application changes remain on a successful private Vercel preview and are not deployed to production.

The two underlying dependency issues now have maintained local repairs: early rejection for oversized constrained Zod collections and a reserved-key/safe-assignment repair for development-only deepmerge. Inngest requests also have a structural budget covering its unconstrained schemas. Installation applies exact-hash patches; direct Next startup and documented test/isolated commands refuse missing or altered repairs. See [scope, regression evidence and maintenance](security-dependency-patches.md). The npm audit still reports eight affected published-package entries (two high and six low); these are not official vendor fixes or a zero-warning audit. Unconstrained Zod use outside the guarded route is not repaired by the backport. Keep the guard and patch verification in the release, and review upstream replacements before removing them. No blanket risk exception has been accepted.

## Prepare a reviewable directory

After committing all intended changes, run from the private repository:

```bash
node scripts/export-open-source.mjs /absolute/path/outside-this-repo/small-tales-release
```

The destination must not exist. The script reads files from a Git commit (`HEAD` by default), never local or untracked files. An optional second argument selects another commit. It uses an explicit allowlist, excludes history and private content, substitutes safe example domains and neutral media placeholders, and writes `RELEASE-MANIFEST.json` with file hashes and transformations. It does not connect to GitHub, initialize Git, or publish anything. Contents are deterministic for a given commit and script version.

For a temporary preview of work in progress only:

```bash
node scripts/export-open-source.mjs /absolute/path/outside-this-repo/small-tales-preview --worktree
```

Preview mode reads tracked source and narrowly allowed new source/documentation files. It still excludes settings and drafts and labels its manifest as a worktree preview. Do not publish a preview; rerun against a reviewed commit.

Review the manifest and scanner results before copying the export into the separate release repository with fresh history. Keep the original private repository and its history intact. Publication and the blog announcement remain separate actions.

## External setup

The environment template inventories application configuration, not working credentials. Storage reference artwork, account-specific Leonardo model availability, a compatible pdf-api.io book template, Gelato product/shipping settings, Stripe test resources, and a verified email domain are separate requirements. Apply the database bootstrap/security migrations before adding data. Keep `INTERNAL_API_SECRET` stable across web and workers; guest capabilities use it. Distributed rate limiting requires the database function supplied by the security migration.
