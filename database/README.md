# Database and storage setup

Use a new Supabase development project and synthetic records. These files contain definitions only; they do not include production exports or customer information.

## Fresh installation

1. Open your new project's SQL Editor as its database administrator. Run [supabase_table_schema.sql](supabase_table_schema.sql) in full. It creates all eleven application tables, required indexes, the approval context trigger, restricted public reviews, and three storage buckets.
2. Run [2026-11-07-release-hardening.sql](2026-11-07-release-hardening.sql), then [2026-11-07-book-creation.sql](2026-11-07-book-creation.sql), in full. They add current administrator checks, restrictive access rules, the shared request limiter and retry-safe book creation used by the application. Apply all three files before starting the app or adding data.
3. Add that project's URL, publishable key and server secret key to your local environment. Never put the secret key in a browser variable. Use the same `INTERNAL_API_SECRET` in the web app and workers.
4. Create your own Supabase Auth user. Grant administrator access only through a trusted dashboard/server operation that writes the boolean `true` to `app_metadata.is_admin`. The SQL policy checks the current `auth.users.raw_app_meta_data` value. An ordinary account, a string such as `"true"`, or user-editable metadata does not qualify.
5. Upload your own permitted reference illustrations at the paths below. Configure the external services described in the main [README](../README.md).
6. Confirm anonymous and ordinary signed-in accounts cannot read customer tables or list private customer storage. Confirm an administrator can load `/admin`, and a server request can call `consume_rate_limit`.

With a PostgreSQL client, the installation steps are equivalent to:

```bash
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f database/supabase_table_schema.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f database/2026-11-07-release-hardening.sql
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f database/2026-11-07-book-creation.sql
```

Set `SUPABASE_DB_URL` privately to your own development database connection string. Do not save it in tracked files. The bootstrap deliberately fails if application tables already exist; it is not an upgrade script. The hardening migration is transactional and may be reapplied. Existing projects require a backup and a separate schema/policy review before applying migrations. The migration does not recreate missing tables, rewrite records, or toggle existing bucket privacy.

## Tables and behavior

| Table | Purpose and important behavior |
| --- | --- |
| `books` | Child details, original photo locator, preview locators and generation status. `orders.book_id` is the authoritative relationship; `books.order_id` is a denormalized webhook pointer. |
| `orders` | Stripe session, payment, shipping/address, SMS consent, PDF locator and print tracking. Stripe sessions are unique. External Gelato identifiers and shipping states are text. |
| `book_photos` | Generated pages. The unique `(book_id, image_reference_number)` pair supports background-job retries/upserts. |
| `book_approvals` | Private preview tokens, decision and print reference. On insertion, a trigger verifies the order belongs to the book and copies the order's current PDF locator/email if omitted. |
| `reminders` | Private email/birthday reminder requests, submitted through the server. |
| `book_logs` | Private event details; records may have no book when a request fails before creation. |
| `email_logs` | Private delivery results. Shipping emails may omit a book ID and preview token. |
| `gelato_logs` | Private print webhook events. |
| `upload_attempt_logs` | Private upload diagnostics and partial IP information. |
| `reviews` | Curated public testimonials. Only displayed fields are granted public read access; public writes are denied. The current model has no moderation/status field, so insert only testimonials intended for publication. |
| `course_signups` | Private course mailing list. Email addresses are unique without regard to capitalization. |

Every application table has row level security. The service role is for trusted server operations. The hardening migration adds administrator access while denying anonymous visitors and ordinary accounts, even when an older permissive policy still exists. It also creates the private request counter and a `consume_rate_limit` function executable only by the service role. Anonymous visitors use the app's guarded server routes rather than accessing customer tables directly.

The book-creation migration adds a private upload-to-book mapping and a service-only `create_book_from_upload` function. The web server hashes a verified upload path with its secret before calling it. Concurrent retries reuse the same original book and preserve its current progress; they cannot create multiple books from one upload. The mapping is inaccessible directly to browser roles and the service role. Rate-counter cleanup uses an expiry index and removes at most 100 expired entries per request.

Timestamps are stored with time zones. Updated-at triggers maintain mutable book/order/photo/approval timestamps. Empty installs have no reviews, mailing-list entries or books; no seed records are needed to load the public pages.

## Storage and artwork

| Bucket | Visibility | Contents |
| --- | --- | --- |
| `book-photos` | Private | Uploaded customer photos, reference illustrations and final PDFs. The server issues temporary upload/download links. |
| `book-images` | Private | Additional generated images used by the bulk signing helper. |
| `review-media` | Public read | Only approved-for-publication testimonial photos/videos. Do not store private material here. |

Bucket configuration alone does not make a private object readable. Customer workflows must obtain a signed link through an authorized server path. A stored `/object/public/...` PDF URL can serve as an opaque locator that the server converts into a signed link; it does not require making its bucket public. The SQL smoke test checks object-list access, not the Storage service's HTTP download/signing behavior.

The default generation configuration expects the following objects inside the **`book-photos` bucket**. These names are relative to that bucket; do not create an extra `book-photos/` folder within it.

```text
cover_image/cover-image-small-tales.jpg
book_images/page_1_kid_running.jpg
book_images/page_2_racecar_driver.jpg
book_images/page_3_baker.jpg
book_images/page_4_olympic_sprinter.jpg
book_images/page_5_astronaut.jpg
book_images/page_6_surfer.jpg
book_images/page_7_rockstar.jpg
book_images/page_8_firefighter.jpg
book_images/page_9_pilot.jpg
book_images/page_10_scientist.jpg
book_images/page_11_student.jpg
```

These paths come from [config/imageReferences.ts](../config/imageReferences.ts) and [inngest/functions/createBookImage.ts](../inngest/functions/createBookImage.ts). A single illustration is currently reused for content, style and pose guidance per page. Change the configuration if your own artwork has different names or separate reference images. The public export excludes the original illustrations, customer photos and original print template. Supply all twelve reference objects yourself, including the student illustration; placeholder marketing artwork does not fill these storage paths.

The PDF service template must accept `Character_Name`, `his_her`, `he_she`, `cover_image`, and `image_1` through `image_11`, matching [inngest/functions/generatePdfs.ts](../inngest/functions/generatePdfs.ts). Configure your own pdf-api.io template and verify page dimensions/bleeds against your chosen Gelato product. The SQL bootstrap does not provision templates, AI model access, payment resources or printing accounts.

## Disposable database checks

Install PostgreSQL 13 or newer with `initdb`, `pg_ctl` and `psql`, then run:

```bash
bash scripts/check-database-schema.sh
# If PostgreSQL is not on PATH:
PG_BIN=/path/to/postgresql/bin bash scripts/check-database-schema.sh
```

The script creates a temporary cluster with networking disabled, applies a small Supabase role/storage fixture, installs the fresh schema, and writes synthetic examples for all eleven tables. It verifies approval context copying, image upserts, duplicate signup protection, private customer access and public review fields. It then simulates unsafe legacy grants, applies each migration twice, checks anonymous/customer/administrator separation and role revocation, and sends concurrent requests to the rate limiter. It also verifies book-creation input checks, transaction rollback and 24 simultaneous retries producing exactly one book. It stops and deletes only its own temporary cluster afterward; it never uses `DATABASE_URL` or contacts an existing project.

The fixture files under `database/tests/` are **only for this disposable check**. Do not run them in Supabase. They model database roles and storage metadata; they do not run Supabase Auth, PostgREST, Storage HTTP endpoints or external providers. Follow the app's manual verification checklist using your own development accounts before deployment.
