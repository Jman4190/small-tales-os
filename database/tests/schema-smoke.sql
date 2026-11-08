-- Synthetic records only. Executed inside the disposable cluster by the script.
BEGIN;
CREATE FUNCTION pg_temp.assert_hidden(relation_name text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE row_count bigint;
BEGIN
  BEGIN
    EXECUTE format('SELECT count(*) FROM public.%I', relation_name) INTO row_count;
    IF row_count <> 0 THEN RAISE EXCEPTION 'Customer records visible in %', relation_name; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- No table grant is also a valid denial.
  END;
END;
$$;

SET ROLE service_role;
INSERT INTO public.books (id, name, gender, age, appearance, original_image_url)
VALUES ('00000000-0000-4000-8000-000000000001', 'Schema Test', 'boy', 5,
  '{"hair":"brown"}', 'uploads/synthetic.jpg');
INSERT INTO public.orders (
  id, book_id, stripe_session_id, payment_status, total_amount, customer_email,
  customer_name, ship_line1, ship_city, ship_state, ship_postal, ship_country,
  phone_number, sms_preview_opt_in, sms_preview_opted_in_at,
  receive_pdf_preview_via_text, tos_accepted_at, pdf_url, gelato_order_id
) VALUES (
  '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
  'cs_schema_test', 'paid', 39.99, 'schema@example.invalid', 'Synthetic Customer',
  '1 Example Street', 'Example', 'NY', '10001', 'US', '+15555550123', true,
  now(), true, now(), 'https://storage.example.invalid/order/book.pdf', 'external-order-test'
);
UPDATE public.books SET order_id = '00000000-0000-4000-8000-000000000002',
  status = 'completed', generated_image_urls = ARRAY['https://example.invalid/preview.jpg']
  WHERE id = '00000000-0000-4000-8000-000000000001';
INSERT INTO public.book_photos (book_id, order_id, image_url, image_reference_number, status)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  'https://example.invalid/photo.jpg', 'image_1', 'generated')
ON CONFLICT (book_id, image_reference_number) DO UPDATE SET image_url = EXCLUDED.image_url;
INSERT INTO public.book_photos (book_id, order_id, image_url, image_reference_number, status)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
  'https://example.invalid/replacement.jpg', 'image_1', 'generated')
ON CONFLICT (book_id, image_reference_number) DO UPDATE SET image_url = EXCLUDED.image_url;
INSERT INTO public.book_approvals (book_id, order_id, token)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'synthetic-approval-token');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.book_approvals
      WHERE token = 'synthetic-approval-token'
      AND pdf_url = 'https://storage.example.invalid/order/book.pdf'
      AND user_email = 'schema@example.invalid') THEN
    RAISE EXCEPTION 'Approval context trigger did not inherit order PDF/email';
  END IF;
  IF (SELECT count(*) FROM public.book_photos) <> 1 THEN
    RAISE EXCEPTION 'Image upsert uniqueness is missing';
  END IF;
END $$;
INSERT INTO public.books (id, name, age)
VALUES ('00000000-0000-4000-8000-000000000003', 'Other Synthetic Book', 6);
DO $$ BEGIN
  BEGIN
    INSERT INTO public.book_approvals (book_id, order_id, token)
    VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'mismatched-token');
    RAISE EXCEPTION 'Mismatched approval book/order accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
INSERT INTO public.reminders (child_name, email, reminder_date) VALUES ('Synthetic', 'schema@example.invalid', CURRENT_DATE + 30);
INSERT INTO public.book_logs (book_id, event, details) VALUES (NULL, 'synthetic-event', '{"ok":true}');
INSERT INTO public.email_logs (order_id, user_email, status, item_id, order_status, gelato_order_id)
VALUES ('00000000-0000-4000-8000-000000000002', 'schema@example.invalid', 'sent', 'item-test', 'shipped', 'external-order-test');
INSERT INTO public.gelato_logs (event_name, event_data) VALUES ('synthetic-event', '{"status":"shipped"}');
INSERT INTO public.upload_attempt_logs (visitor_id, session_upload_attempts, remaining_uploads)
VALUES ('synthetic-visitor', 1, 2);
INSERT INTO public.reviews (name, rating, text) VALUES ('Synthetic Reviewer', 5, 'Public testimonial');
INSERT INTO public.course_signups (email) VALUES ('schema@example.invalid');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.course_signups (email) VALUES ('SCHEMA@example.invalid');
    RAISE EXCEPTION 'Case-insensitive duplicate course signup accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('book-photos', 'synthetic.pdf'), ('book-images', 'synthetic.jpg'), ('review-media', 'public-test.jpg');
RESET ROLE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id IN ('book-photos', 'book-images') AND public) THEN
    RAISE EXCEPTION 'Customer bucket is public';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'review-media' AND public) THEN
    RAISE EXCEPTION 'Review media bucket is not public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN ('books', 'orders', 'book_photos', 'reminders', 'book_approvals', 'book_logs',
        'email_logs', 'gelato_logs', 'upload_attempt_logs', 'reviews', 'course_signups')
      AND NOT rowsecurity) THEN
    RAISE EXCEPTION 'Application table is missing row level security';
  END IF;
END $$;

SET ROLE anon;
SELECT pg_temp.assert_hidden(name) FROM unnest(ARRAY[
  'books', 'orders', 'book_photos', 'reminders', 'book_approvals', 'book_logs',
  'email_logs', 'gelato_logs', 'upload_attempt_logs', 'course_signups'
]) AS name;
SELECT id, name, review_date, rating, text, verified, media_path, media_type, poster_image_path FROM public.reviews;
DO $$ BEGIN
  BEGIN
    PERFORM created_at FROM public.reviews;
    RAISE EXCEPTION 'Nonpublic review column is readable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reminders(child_name, email, reminder_date) VALUES ('Attacker', 'bad@example.invalid', CURRENT_DATE);
    RAISE EXCEPTION 'Direct anonymous reminder write accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  IF (SELECT count(*) FROM storage.objects) <> 1 OR EXISTS (
      SELECT 1 FROM storage.objects WHERE bucket_id <> 'review-media') THEN
    RAISE EXCEPTION 'Private Storage objects can be listed or public media unavailable';
  END IF;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000010","app_metadata":{"is_admin":true}}', true);
-- The JWT deliberately claims admin while auth.users is a regular customer.
-- The hardening migration must consult authoritative server-managed metadata.
SELECT pg_temp.assert_hidden(name) FROM unnest(ARRAY[
  'books', 'orders', 'book_photos', 'reminders', 'book_approvals', 'book_logs',
  'email_logs', 'gelato_logs', 'upload_attempt_logs', 'course_signups'
]) AS name;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id <> 'review-media') THEN
    RAISE EXCEPTION 'Customer can list private Storage objects';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
