-- Fresh-install schema for a NEW Supabase project. Contains no customer data.
-- Run this file first, then 2026-11-07-release-hardening.sql and
-- 2026-11-07-book-creation.sql.
-- Existing projects must use a reviewed migration instead of this bootstrap.
-- Supabase supplies anon/authenticated/service_role and the auth/storage schemas.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Denormalized pointer written by the Stripe webhook. orders.book_id is the
  -- authoritative FK; a second FK would make existing PostgREST joins ambiguous.
  order_id uuid,
  name text NOT NULL,
  gender text,
  age integer NOT NULL,
  appearance jsonb,
  original_image_url text,
  generated_image_url text,
  generated_image_urls text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed')),
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  customer_email text,
  customer_name text,
  shipping_address jsonb,
  ship_line1 text,
  ship_line2 text,
  ship_city text,
  ship_state text,
  ship_postal text,
  ship_country text,
  phone_number text,
  sms_preview_opt_in boolean NOT NULL DEFAULT false,
  sms_preview_opted_in_at timestamptz,
  receive_pdf_preview_via_text boolean NOT NULL DEFAULT false,
  tos_accepted_at timestamptz,
  -- Gelato supplies its own expanding set of shipping states and external IDs.
  shipping_status text NOT NULL DEFAULT 'pending',
  tracking_number text,
  carrier text,
  gelato_order_id text,
  pdf_url text,
  admin_pdf_url text,
  slack_thread_ts text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_book_id_idx ON public.orders(book_id);
CREATE INDEX orders_customer_email_idx ON public.orders(customer_email);
CREATE INDEX orders_payment_created_idx ON public.orders(payment_status, created_at DESC);
CREATE INDEX orders_gelato_order_id_idx ON public.orders(gelato_order_id);

CREATE TABLE public.book_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  character_name text,
  character_gender text,
  reference_image_url text,
  image_url text NOT NULL,
  image_reference_number text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'generated', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Required by generateBookImages.ts upsert onConflict.
  CONSTRAINT book_photos_book_image_key UNIQUE (book_id, image_reference_number)
);
CREATE INDEX book_photos_order_id_idx ON public.book_photos(order_id);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name text NOT NULL,
  email text NOT NULL,
  reminder_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_date_idx ON public.reminders(reminder_date);

CREATE TABLE public.book_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  pdf_url text,
  user_email text,
  decline_reason text,
  print_job_id text,
  auto_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_approvals_book_created_idx ON public.book_approvals(book_id, created_at DESC);
CREATE INDEX book_approvals_order_created_idx ON public.book_approvals(order_id, created_at DESC);

-- generatePdfs.ts deliberately inserts only book/order IDs and a token. The
-- approval must inherit the PDF locator and email after the order is updated.
CREATE FUNCTION private.populate_book_approval_context()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  linked_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO STRICT linked_order FROM public.orders WHERE id = NEW.order_id;
  IF linked_order.book_id <> NEW.book_id THEN
    RAISE EXCEPTION 'Approval book does not belong to its order'
      USING ERRCODE = '23514';
  END IF;
  NEW.pdf_url := COALESCE(NEW.pdf_url, linked_order.pdf_url);
  NEW.user_email := COALESCE(NEW.user_email, linked_order.customer_email);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.populate_book_approval_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.populate_book_approval_context() TO service_role;
CREATE TRIGGER populate_book_approval_context
  BEFORE INSERT ON public.book_approvals
  FOR EACH ROW EXECUTE FUNCTION private.populate_book_approval_context();

CREATE TABLE public.book_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  event text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX book_logs_book_timestamp_idx ON public.book_logs(book_id, timestamp DESC);

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  -- Shipping email logs do not include a book ID or preview token.
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  user_email text NOT NULL,
  token text,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  message_id text,
  error text,
  email_type text,
  item_id text,
  order_status text,
  gelato_order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_logs_order_created_idx ON public.email_logs(order_id, created_at DESC);
CREATE INDEX email_logs_book_created_idx ON public.email_logs(book_id, created_at DESC);

CREATE TABLE public.gelato_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gelato_logs_created_idx ON public.gelato_logs(created_at DESC);

CREATE TABLE public.upload_attempt_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  book_id uuid REFERENCES public.books(id) ON DELETE SET NULL,
  session_upload_attempts integer NOT NULL,
  remaining_uploads integer NOT NULL,
  hit_max_limit boolean NOT NULL DEFAULT false,
  multiple_attempts boolean NOT NULL DEFAULT false,
  user_agent text,
  ip_partial text,
  timestamp timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX upload_attempt_logs_visitor_time_idx ON public.upload_attempt_logs(visitor_id, timestamp DESC);
CREATE INDEX upload_attempt_logs_book_idx ON public.upload_attempt_logs(book_id);

-- These are curated public testimonials, not unreviewed customer submissions.
-- There is no approval/status field in the application's current review model.
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  media_path text,
  media_type text CHECK (media_type IN ('image', 'video')),
  poster_image_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_date_idx ON public.reviews(review_date DESC);

CREATE TABLE public.course_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX course_signups_email_key ON public.course_signups(lower(email));

CREATE FUNCTION private.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.touch_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.touch_updated_at() TO service_role;
CREATE TRIGGER touch_books_updated_at BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER touch_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER touch_book_photos_updated_at BEFORE UPDATE ON public.book_photos
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();
CREATE TRIGGER touch_book_approvals_updated_at BEFORE UPDATE ON public.book_approvals
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- Deny browser access to all customer records. Server routes authenticate or
-- validate their capability before using the service role. Reviews are the sole
-- public table, and only the fields rendered by the app are readable.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'books', 'orders', 'book_photos', 'reminders', 'book_approvals', 'book_logs',
    'email_logs', 'gelato_logs', 'upload_attempt_logs', 'reviews', 'course_signups'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END;
$$;
GRANT SELECT (id, name, review_date, rating, text, verified, media_path, media_type, poster_image_path)
  ON public.reviews TO anon, authenticated;
CREATE POLICY public_review_fields ON public.reviews FOR SELECT TO anon, authenticated USING (true);

-- Supabase Storage already owns its bucket/object tables. Both customer buckets
-- remain private; signed upload/download URLs are issued by the server only.
INSERT INTO storage.buckets (id, name, public) VALUES
  ('book-photos', 'book-photos', false),
  ('book-images', 'book-images', false),
  ('review-media', 'review-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
CREATE POLICY public_review_media ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'review-media');

COMMIT;
