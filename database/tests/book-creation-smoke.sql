BEGIN;
CREATE FUNCTION pg_temp.creation_payload(image_path text DEFAULT 'uploads/synthetic-creation.jpg') RETURNS jsonb
LANGUAGE sql AS $$
  SELECT jsonb_build_object('name', 'Synthetic Child', 'gender', 'boy', 'age', 5,
    'original_image_url', image_path, 'status', 'pending_verification',
    'appearance', jsonb_build_object('skinTone', 'synthetic', 'hair', 'brown', 'eyeColor', 'blue'))
$$;

SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload());
    RAISE EXCEPTION 'Anonymous caller created a book' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000011"}', true);
DO $$ BEGIN
  BEGIN
    PERFORM public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload());
    RAISE EXCEPTION 'Browser administrator called server-only book creation' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET ROLE service_role;
DO $$
DECLARE first_result jsonb; retry_result jsonb; invalid_book jsonb; initial_count bigint;
BEGIN
  BEGIN
    PERFORM * FROM private.upload_creations;
    RAISE EXCEPTION 'Mapping table is directly accessible to service role' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT count(*) INTO initial_count FROM public.books;
  BEGIN
    PERFORM public.create_book_from_upload(NULL, pg_temp.creation_payload());
    RAISE EXCEPTION 'NULL upload key accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.create_book_from_upload('not-a-hash', pg_temp.creation_payload());
    RAISE EXCEPTION 'Invalid upload key accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.create_book_from_upload(repeat('a', 64), NULL);
    RAISE EXCEPTION 'NULL payload accepted' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  FOR invalid_book IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    '{}'::jsonb,
    pg_temp.creation_payload() || '{"name":""}',
    pg_temp.creation_payload() || '{"name":7}',
    pg_temp.creation_payload() || '{"gender":"invalid"}',
    pg_temp.creation_payload() || '{"age":0}',
    pg_temp.creation_payload() || '{"age":19}',
    pg_temp.creation_payload() || '{"age":"5"}',
    pg_temp.creation_payload() || '{"status":"completed"}',
    pg_temp.creation_payload() || '{"appearance":{}}',
    pg_temp.creation_payload() || '{"appearance":{"skinTone":"synthetic","hair":null,"eyeColor":"blue"}}',
    pg_temp.creation_payload() || jsonb_build_object('appearance', jsonb_build_object('skinTone', repeat('a', 501), 'hair', 'brown', 'eyeColor', 'blue')),
    pg_temp.creation_payload('other-bucket/private.jpg')
  )) LOOP
    BEGIN
      PERFORM public.create_book_from_upload(repeat('a', 64), invalid_book);
      RAISE EXCEPTION 'Invalid book details accepted: %', invalid_book USING ERRCODE = 'check_violation';
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.books) <> initial_count THEN
    RAISE EXCEPTION 'Invalid creation left a book behind';
  END IF;

  first_result := public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload());
  retry_result := public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload() || '{"name":"Changed Retry Name"}');
  IF first_result->'created' <> 'true'::jsonb OR retry_result->'created' <> 'false'::jsonb
     OR first_result->'book'->>'id' IS DISTINCT FROM retry_result->'book'->>'id'
     OR retry_result->'book'->>'name' <> 'Synthetic Child'
     OR (SELECT count(*) FROM public.books) <> initial_count + 1 THEN
    RAISE EXCEPTION 'Repeated upload did not return exactly one original book';
  END IF;
  UPDATE public.books SET status = 'processing' WHERE id = (first_result->'book'->>'id')::uuid;
  retry_result := public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload());
  IF retry_result->'book'->>'status' <> 'processing' OR retry_result->'created' <> 'false'::jsonb THEN
    RAISE EXCEPTION 'Retry failed to preserve current book state';
  END IF;
  BEGIN
    PERFORM public.create_book_from_upload(repeat('a', 64), pg_temp.creation_payload('uploads/different.jpg'));
    RAISE EXCEPTION 'Key was rebound to another image' USING ERRCODE = 'check_violation';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  retry_result := public.create_book_from_upload(repeat('b', 64), pg_temp.creation_payload('uploads/second.jpg'));
  IF retry_result->'created' <> 'true'::jsonb
     OR retry_result->'book'->>'id' = first_result->'book'->>'id' THEN
    RAISE EXCEPTION 'Independent upload was not assigned its own book';
  END IF;

  BEGIN
    PERFORM public.create_book_from_upload(repeat('d', 64), pg_temp.creation_payload('uploads/rollback.jpg'));
    RAISE EXCEPTION 'Synthetic transaction failure';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.books WHERE original_image_url = 'uploads/rollback.jpg') THEN
    RAISE EXCEPTION 'Failed transaction left an orphan book';
  END IF;
  retry_result := public.create_book_from_upload(repeat('d', 64), pg_temp.creation_payload('uploads/rollback.jpg'));
  IF retry_result->'created' <> 'true'::jsonb THEN
    RAISE EXCEPTION 'Failed transaction left a stale upload mapping';
  END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'private'
      AND tablename = 'upload_creations' AND rowsecurity) THEN
    RAISE EXCEPTION 'Upload mapping lacks row level security';
  END IF;
END $$;
ROLLBACK;
