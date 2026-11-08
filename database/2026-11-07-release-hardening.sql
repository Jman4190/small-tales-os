-- Apply to an existing Supabase project. Transactional, repeatable; no customer rows changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Read the current server-managed role, not stale or user-editable JWT metadata.
CREATE OR REPLACE FUNCTION private.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND raw_app_meta_data -> 'is_admin' = 'true'::jsonb)
$$;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['books','orders','book_photos','book_approvals','reminders','book_logs','email_logs','gelato_logs','upload_attempt_logs','course_signups'] LOOP
    IF to_regclass('public.' || target) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', target);
      EXECUTE format('DROP POLICY IF EXISTS release_anon_denied ON public.%I', target);
      EXECUTE format('CREATE POLICY release_anon_denied ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)', target);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', target);
      EXECUTE format('DROP POLICY IF EXISTS release_admin_only ON public.%I', target);
      EXECUTE format('CREATE POLICY release_admin_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))', target);
      EXECUTE format('DROP POLICY IF EXISTS release_admin_access ON public.%I', target);
      EXECUTE format('CREATE POLICY release_admin_access ON public.%I FOR ALL TO authenticated USING ((SELECT private.is_admin())) WITH CHECK ((SELECT private.is_admin()))', target);
    END IF;
  END LOOP;
END $$;

-- Reviews are public testimonials; order/customer linkage never needs browser access.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, name, review_date, rating, text, verified, media_path, media_type, poster_image_path)
  ON public.reviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO service_role;

-- Policies cannot be bypassed by any previously broad, permissive bucket policies.
DROP POLICY IF EXISTS release_private_media_anon ON storage.objects;
CREATE POLICY release_private_media_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
  USING (bucket_id NOT IN ('book-photos','book-images'))
  WITH CHECK (bucket_id NOT IN ('book-photos','book-images'));
DROP POLICY IF EXISTS release_private_media_authenticated ON storage.objects;
CREATE POLICY release_private_media_authenticated ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING (bucket_id NOT IN ('book-photos','book-images') OR (SELECT private.is_admin()))
  WITH CHECK (bucket_id NOT IN ('book-photos','book-images') OR (SELECT private.is_admin()));

CREATE TABLE IF NOT EXISTS private.request_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);
ALTER TABLE private.request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.request_limits FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS request_limits_reset_at_idx ON private.request_limits(reset_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE consumed integer; reset_time timestamptz; now_time timestamptz := clock_timestamp();
BEGIN
  IF p_key IS NULL OR p_limit IS NULL OR p_window_seconds IS NULL
     OR length(p_key) <> 64 OR p_limit < 1 OR p_limit > 1000 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;
  -- A unique key + UPSERT row lock serializes simultaneous requests across servers.
  INSERT INTO private.request_limits AS counters (key, count, reset_at)
    VALUES (p_key, 1, now_time + make_interval(secs => p_window_seconds))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN counters.reset_at <= now_time THEN 1 ELSE LEAST(counters.count + 1, p_limit + 1) END,
    reset_at = CASE WHEN counters.reset_at <= now_time THEN now_time + make_interval(secs => p_window_seconds) ELSE counters.reset_at END
  RETURNING count, reset_at INTO consumed, reset_time;
  -- Limit indexed cleanup work per request and avoid waiting on other cleaners.
  DELETE FROM private.request_limits WHERE key IN (
    SELECT key FROM private.request_limits
    WHERE reset_at < now_time - interval '1 day'
    ORDER BY reset_at LIMIT 100 FOR UPDATE SKIP LOCKED
  );
  RETURN jsonb_build_object('allowed', consumed <= p_limit, 'retry_after', GREATEST(1, ceil(extract(epoch FROM reset_time - now_time))::integer));
END $$;
REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
