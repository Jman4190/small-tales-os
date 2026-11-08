# Isolated local integration testing

This setup runs the real Next.js application, a separate Supabase test project, Stripe Sandbox/test checkout, and a local Inngest worker. Only the paid AI, PDF, email, and print providers are simulated. It checks application wiring and authorization; it does not assess image safety/quality, email delivery, PDF typography/bleeds, or real printing/shipping.

## Private profile

Create a new Supabase project and apply both database scripts in [database setup](../database/README.md). Use synthetic records only. Create Stripe resources in a dedicated Sandbox or test environment; claim temporary sandboxes before expecting all account capabilities. Keep a private environment file **outside this repository**, with mode `600`, containing:

```dotenv
ISOLATED_TEST_PROJECT_REF=your_twenty_character_test_ref
NEXT_PUBLIC_SUPABASE_URL=https://your_twenty_character_test_ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=complete_test_project_browser_key
SUPABASE_SECRET_KEY=complete_test_project_server_key
INTERNAL_API_SECRET=your_own_random_test_only_secret_of_at_least_32_characters
STRIPE_SECRET_KEY=complete_sk_test_or_rk_test_or_rkcs_test_key
STRIPE_WEBHOOK_SECRET=your_test_listener_webhook_secret
STRIPE_PRICE_ID=your_test_price
STRIPE_TAX_RATE_ID=your_test_tax_resource
STRIPE_SHIPPING_RATE_ID=your_test_shipping_rate
STRIPE_PAYMENT_METHOD_CONFIGURATION_ID=your_test_payment_method_configuration
```

The launcher uses Node's environment parser, never `source` or shell evaluation. It rejects a profile inside the repository, masked/short Supabase keys, a mismatched project URL/ref, the main `.env.local` project or service key, and live Stripe keys. The internal secret must differ from the main environment; if omitted, a stable random mode-600 sidecar is created beside the private profile. Do not paste any values into issues, screenshots, or committed files.

## Start and stop

Install the locked dependencies with `npm ci`, then validate without making network requests:

```bash
node scripts/start-isolated-test.mjs /absolute/private/profile.env --check
```

For upload, verification, and preview-generation testing before checkout resources are complete:

```bash
node scripts/start-isolated-test.mjs /absolute/private/profile.env --preview-only
```

For checkout and the remaining workflow, complete all Stripe fields and run without a mode flag:

```bash
node scripts/start-isolated-test.mjs /absolute/private/profile.env
```

The launcher writes **only synthetic** reference artwork to all twelve configured paths in the test project's private `book-photos` bucket, plus a public fixture PNG and one-page PDF in `review-media/isolated/`. It writes `synthetic-book.png` and `synthetic-preview.pdf` beside the private profile for browser uploads. These reserved fixture paths are overwritten on each start. It does not copy production rows or artwork.

Open [the local app](http://localhost:3015) and [the worker dashboard](http://localhost:8289). Do not run another Next.js dev server from the same working directory while this launcher is running. Use **only `synthetic-book.png`** for uploads, a made-up child name such as `Example`, and addresses/emails reserved for testing. The verification fixture returns a fixed synthetic appearance for its own fixture namespace; it does not inspect or approve real people. No real customer material belongs in this test project.

Stop the launcher with Ctrl+C; it terminates both child processes. Test data and the private profile remain for inspection. Delete or reset the dedicated test project separately when finished; the launcher never cleans up a database automatically.

## Stripe test webhook forwarding

In a separate terminal, use a Stripe CLI named profile authenticated to the same dedicated Sandbox:

```bash
stripe --project-name YOUR_TEST_PROFILE listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired \
  --forward-to http://localhost:3015/api/stripe/webhooks
```

Stripe CLI 1.55.8 uses `--project-name` to select a named entry in its local CLI configuration; this is separate from the Supabase project ref and the private `profile.env` file. That CLI entry must be authenticated to the intended Stripe test account/Sandbox. Put the listener's signing secret in the private profile, then restart the launcher. Use Stripe's test payment details, never real card information. A temporary claimable Sandbox may not support shipping/payment configuration until its owner claims it. Use Stripe's sandbox-only placeholder autofill if business setup is required; never enter real identity or bank details for this workflow. Checkout also requires a terms-of-service URL in the Sandbox's public business details when the app requests consent. `--preview-only` deliberately makes no promise that checkout is ready.

## Isolation and limits

The launcher builds a restricted child environment, explicitly empties known source/dotenv service settings so Next cannot pick up production values from `.env.local`, forces local app/worker origins, and uses inert placeholders for simulated provider initialization. Slack, Twilio, advertising, analytics, external logging, and production Inngest keys are cleared. The server layout also omits Meta/Google advertising scripts, their prefetch hints, and Vercel analytics components when the isolated fixture flag is active; this covers browser requests that the Node preload cannot intercept. A local font mock uses system fallbacks without downloading Google fonts.

The Node preload intercepts the installed Fal SDK's storage initiation/upload and queue submit/status/result requests, Leonardo initialization/upload/generation/retrieval, pdf-api.io generation, Cloudflare email sending, and Gelato order creation. It returns fixed fixture media, accepts email into a local sink, and records simulated print success. Its own logs contain event types only. Unrecognized `fetch` destinations and Node HTTP(S) destinations fail closed; only the exact test Supabase host, Stripe's API, and the two local app/worker ports are allowed. Fetch redirects are rejected. The local native Inngest binary is a separate process; the Node preload is a development transport guard, not an operating-system network sandbox or protection against arbitrary code.

Supabase storage/database operations and Stripe test checkout are real requests to the selected test accounts. Provider responses are deliberately simplified and do not simulate every error, retry, rendering option, refund, or fulfillment status. Local Inngest step sleeps still take their configured time. A successful simulated order does not verify real AI, email delivery, PDF print quality, or Gelato fulfillment. The known upstream Inngest/Zod advisory and production release gates in [the release checklist](open-source-release.md) remain applicable.

Next's optional startup version and advisory metadata requests to the npm registry receive an explicit offline `503` response inside the harness. No network access is granted and no clean advisory result or latest-version value is invented. Next may report that it could not assess updates; run the repository dependency audit separately. Other blocked requests retain safe fixed category diagnostics and still fail closed.

Run the offline fixture and guard checks with:

```bash
node --test scripts/isolated-test.test.mjs
```
