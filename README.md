# Small Tales

**Unmaintained side project.** Fork this code to build your own version. Read [the project story](https://www.smalltalesbooks.com/blog/why-im-open-sourcing-small-tales), or find [@learnwithjabe on X](https://x.com/learnwithjabe).

Small Tales is a reference implementation of a personalized children's book service. It covers photo upload, AI image generation, previews, checkout, PDF creation, approval, and print fulfillment.

Installing this code does not create the external accounts, print templates, illustration references, or database configuration needed to fulfill a book. Use your own development accounts and synthetic data during setup.

## Requirements

- Node.js 22.22 or newer and npm.
- A separate Supabase development project.
- Leonardo.ai and fal for image generation and photo verification.
- Inngest for background jobs; Stripe test resources for checkout.
- Cloudflare Email Sending, pdf-api.io, and Gelato for email, PDFs, and printing.

The app uses Next.js, React, TypeScript, Tailwind, and Jest. Twilio, Slack, BetterStack, PostHog, and Facebook provide optional capabilities; leave their values empty until needed. Some optional routes return configuration errors until configured.

## Local setup

1. Run `./setup.sh`. It installs the locked dependencies and creates `.env.local` from [.env.example](.env.example), preserving any existing file. It does not build or contact services.
2. Add your Supabase project URL, publishable/secret keys, app URLs, and a random `INTERNAL_API_SECRET`. Keep this secret identical between the web app and background workers. Only values prefixed `NEXT_PUBLIC_` may reach the browser.
3. Follow [database setup](database/README.md) for a fresh project. Apply all migrations and access rules before adding data; never copy production customer rows. Create the storage buckets and reference assets described there. Existing production installations require a separate migration review.
4. In Supabase Auth, set the site URL to `http://localhost:3000` and allow the app's `/auth/confirm` callback. Create your own user. Grant administrators access only through trusted server/dashboard changes to `app_metadata.is_admin = true`; user-editable metadata is insufficient.
5. Configure the services for the features you want to test, using the table below.
6. Start `INNGEST_DEV=1 npm run dev` and, in another terminal, `npm run inngest:dev`. Open [the app](http://localhost:3000) and [Inngest](http://localhost:8288). Setup installs the locked official Inngest CLI 1.51.0 and downloads its matching binary; no global CLI installation is required. The background-job command connects it to `/api/inngest`. Keep the app in local development mode so test events stay on your computer. See [Inngest's local development guide](https://www.inngest.com/docs/local-development) for other ports or installation methods.

## Service setup

| Feature | Configuration and resources |
| --- | --- |
| AI images | Set `FAL_KEY` and `LEONARDO_API_KEY`. Supply reference illustrations you may use at the storage paths in `config/imageReferences.ts` and `utils/leonardo.ts`. Confirm the selected Leonardo model IDs remain available to your account. |
| Checkout | Create a Stripe test secret and webhook secret, plus the price, tax, shipping, and payment method resources for the four `STRIPE_*_ID` values in the same test account. Forward test events to `/api/stripe/webhooks`. |
| Background jobs | Use your own Inngest event/signing keys for deployments. Attach development jobs only to the local app. |
| Email | Verify your own domain in Cloudflare Email Sending; configure account ID and token. Update approved sender/reply addresses in `lib/email.ts` before sending. Exported addresses use `example.com`. Set your own `ADMIN_NOTIFICATION_EMAIL`. Resend is an explicit fallback selected with `EMAIL_PROVIDER=resend`. |
| PDF | Create a pdf-api.io template matching the fields in `inngest/functions/generatePdfs.ts`. Set `PDF_API_KEY` and `PDF_TEMPLATE_ID`. The original print template is not included. Review dimensions, bleeds, and a print proof. |
| Printing | Configure your Gelato key, secret, and `/api/gelato/webhooks`. Review product UID, country, currency, and shipping in the Gelato routes. Requests may place paid print orders. |
| SMS and alerts | Use your own verified Twilio sender and Slack destinations. Shared SMS uses API key credentials; the legacy direct route also uses `TWILIO_AUTH_TOKEN`. |

Set both app URL variables to your local or deployed origin. BetterStack logging requires both its token and your own HTTPS endpoint (`LOGTAIL_ENDPOINT` on the server; `NEXT_PUBLIC_LOGTAIL_ENDPOINT` with a separate browser-safe token in the browser). No production collection endpoint is provided. Replace example links, contact details, policies, marketing copy, and metadata before launching. Review integration costs and account-specific settings.

## Verification

For a separate Supabase project, Stripe Sandbox, a local worker, and simulated paid providers, use [the isolated testing guide](docs/isolated-testing.md). This setup keeps production credentials and real customer material out of local workflow tests.

```bash
npm test -- --runInBand
npm run test:security
npm run lint
npm run build
npm audit --audit-level=moderate
```

`npm ci` automatically applies two pinned security backports. Build, start, development and test commands verify them before running. Do not disable installation scripts. The dependency audit still reports the published package versions; see [the patch details and regression checks](docs/security-dependency-patches.md) for the exact fixes, limits, and removal procedure.

`npm run lint` checks TypeScript. A build does not prove external integrations work. In a test environment, verify anonymous visitors cannot read customer tables/storage, one visitor cannot access another visitor's book, and ordinary accounts cannot use administrator actions. Then exercise guest upload, preview, Stripe test checkout, background work, email, approval, and print proof using your own accounts.

## Release contents and license

The existing MIT [LICENSE](LICENSE) covers the released code. Vendored PDF.js files retain Apache 2.0 notices; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Dependency licenses still apply.

The public export excludes original Git history, credentials, customer material, course/blog drafts, and original branding, photos, illustrations, videos, logos, and sample books. Neutral generated placeholders replace local marketing images. Built-in browser collectors are disabled and the original advertising account IDs are removed; review and configure your own tracking deliberately before enabling it. The course landing page and blog feature code remain examples. MIT licensing does not grant rights to the Small Tales brand or material absent from the release.

See [the release checklist](docs/open-source-release.md), [contributing guide](CONTRIBUTING.md), and [security policy](SECURITY.md). A prepared source directory is not publication or confirmation that production is secured.

Paid preview requests also have shared daily ceilings (`AI_DAILY_CREATE_LIMIT`, default 100, and `AI_DAILY_VERIFY_LIMIT`, default 200) across all visitors. These count dispatch/verification attempts, including safe retries. Configure limits for your expected traffic and provider budget; provider spending caps remain separate.
