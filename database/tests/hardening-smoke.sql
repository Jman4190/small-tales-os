BEGIN;
SET ROLE service_role;
INSERT INTO public.books (id, name, age)
VALUES ('00000000-0000-4000-8000-000000000099', 'Synthetic Admin Check', 5);
RESET ROLE;

SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.books) <> 0 THEN
    RAISE EXCEPTION 'Inherited PUBLIC grant bypassed anonymous denial';
  END IF;
  BEGIN
    PERFORM public.consume_rate_limit(repeat('a', 64), 3, 60);
    RAISE EXCEPTION 'Anonymous caller executed service-only rate RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000010","app_metadata":{"is_admin":true}}', true);
DO $$ BEGIN
  IF private.is_admin() OR (SELECT count(*) FROM public.books) <> 0 THEN
    RAISE EXCEPTION 'Forged or stale JWT metadata granted administrator access';
  END IF;
  BEGIN
    PERFORM public.consume_rate_limit(repeat('a', 64), 3, 60);
    RAISE EXCEPTION 'Ordinary account executed service-only rate RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000012"}', true);
DO $$ BEGIN
  IF private.is_admin() OR (SELECT count(*) FROM public.books) <> 0 THEN
    RAISE EXCEPTION 'String-valued admin metadata granted administrator access';
  END IF;
END $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011"}', true);
DO $$ BEGIN
  IF NOT private.is_admin() OR (SELECT count(*) FROM public.books) <> 1 THEN
    RAISE EXCEPTION 'Current boolean administrator cannot read customer tables';
  END IF;
  BEGIN
    PERFORM public.consume_rate_limit(repeat('a', 64), 3, 60);
    RAISE EXCEPTION 'Administrator account executed service-only rate RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
UPDATE public.books SET name = 'Synthetic Admin Update'
WHERE id = '00000000-0000-4000-8000-000000000099';
RESET ROLE;
UPDATE auth.users SET raw_app_meta_data = '{}' WHERE id = '00000000-0000-4000-8000-000000000011';
SET ROLE authenticated;
DO $$ BEGIN
  IF private.is_admin() OR (SELECT count(*) FROM public.books) <> 0 THEN
    RAISE EXCEPTION 'Revoked administrator retained access with an existing JWT';
  END IF;
END $$;
RESET ROLE;

SET ROLE service_role;
DO $$
DECLARE response jsonb; n integer;
BEGIN
  FOR n IN 1..4 LOOP
    response := public.consume_rate_limit(repeat('a', 64), 3, 60);
    IF (response->>'allowed')::boolean <> (n <= 3)
       OR (response->>'retry_after')::integer NOT BETWEEN 1 AND 60 THEN
      RAISE EXCEPTION 'Unexpected rate limit response at call %: %', n, response;
    END IF;
  END LOOP;
  BEGIN
    PERFORM public.consume_rate_limit(NULL, 3, 60);
    RAISE EXCEPTION 'NULL key accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  BEGIN
    PERFORM public.consume_rate_limit(repeat('a', 64), NULL, 60);
    RAISE EXCEPTION 'NULL limit accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  BEGIN
    PERFORM public.consume_rate_limit(repeat('a', 64), 3, NULL);
    RAISE EXCEPTION 'NULL window accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  BEGIN
    PERFORM public.consume_rate_limit('short', 3, 60);
    RAISE EXCEPTION 'Short key accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
END $$;
RESET ROLE;
UPDATE private.request_limits SET reset_at = now() - interval '1 minute' WHERE key = repeat('a', 64);
SET ROLE service_role;
DO $$ BEGIN
  IF NOT (public.consume_rate_limit(repeat('a', 64), 3, 60)->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Expired request limit did not reset';
  END IF;
END $$;
RESET ROLE;
INSERT INTO private.request_limits(key, count, reset_at)
SELECT md5('expired-' || n) || md5('cleanup-' || n), 1, now() - interval '2 days'
FROM generate_series(1, 250) AS n;
SET ROLE service_role;
SELECT public.consume_rate_limit(repeat('e', 64), 3, 60);
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM private.request_limits WHERE reset_at < now() - interval '1 day') <> 150 THEN
    RAISE EXCEPTION 'Rate limit cleanup did not process exactly its 100-row bound';
  END IF;
  IF to_regclass('private.request_limits_reset_at_idx') IS NULL THEN
    RAISE EXCEPTION 'Request limit cleanup index is missing';
  END IF;
END $$;
ROLLBACK;
