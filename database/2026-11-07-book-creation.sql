-- Apply after the fresh schema (new projects) and release-hardening migration.
-- Adds retry-safe server-only book creation; no existing customer rows change.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.upload_creations (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  book_id uuid NOT NULL UNIQUE REFERENCES public.books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.upload_creations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.upload_creations FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_book_from_upload(p_upload_key text, p_book jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  existing_book public.books%ROWTYPE;
  appearance_key text;
BEGIN
  IF p_upload_key IS NULL OR p_upload_key !~ '^[0-9a-f]{64}$'
     OR p_book IS NULL OR jsonb_typeof(p_book) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid book creation parameters' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_book->'name') IS DISTINCT FROM 'string'
     OR length(btrim(p_book->>'name')) NOT BETWEEN 1 AND 100
     OR jsonb_typeof(p_book->'gender') IS DISTINCT FROM 'string'
     OR p_book->>'gender' NOT IN ('boy', 'girl')
     OR jsonb_typeof(p_book->'age') IS DISTINCT FROM 'number'
     OR p_book->>'age' !~ '^([1-9]|1[0-8])$'
     OR jsonb_typeof(p_book->'original_image_url') IS DISTINCT FROM 'string'
     OR length(p_book->>'original_image_url') > 1024
     OR p_book->>'original_image_url' !~ '^uploads/[a-zA-Z0-9_-]+\.(jpe?g|png|webp|heic|heif)$'
     OR p_book->>'status' IS DISTINCT FROM 'pending_verification'
     OR jsonb_typeof(p_book->'appearance') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid book details' USING ERRCODE = '22023';
  END IF;
  FOREACH appearance_key IN ARRAY ARRAY['skinTone', 'hair', 'eyeColor'] LOOP
    IF jsonb_typeof(p_book->'appearance'->appearance_key) IS DISTINCT FROM 'string'
       OR length(p_book->'appearance'->>appearance_key) > 500 THEN
      RAISE EXCEPTION 'Invalid verified appearance' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Lock the upload for this transaction before reading its mapping. A retry
  -- waits for the first transaction to commit instead of creating another book.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('book-upload:' || p_upload_key, 0));
  SELECT books.* INTO existing_book FROM private.upload_creations AS creations
    JOIN public.books AS books ON books.id = creations.book_id
    WHERE creations.key = p_upload_key;
  IF FOUND THEN
    IF existing_book.original_image_url IS DISTINCT FROM p_book->>'original_image_url' THEN
      RAISE EXCEPTION 'Upload key does not match its original image' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('book', to_jsonb(existing_book), 'created', false);
  END IF;

  INSERT INTO public.books (name, gender, age, original_image_url, status, appearance)
    VALUES (
      btrim(p_book->>'name'), p_book->>'gender', (p_book->>'age')::integer,
      p_book->>'original_image_url', 'pending_verification',
      jsonb_build_object(
        'skinTone', p_book->'appearance'->>'skinTone',
        'hair', p_book->'appearance'->>'hair',
        'eyeColor', p_book->'appearance'->>'eyeColor'
      )
    ) RETURNING * INTO existing_book;
  INSERT INTO private.upload_creations (key, book_id) VALUES (p_upload_key, existing_book.id);
  RETURN jsonb_build_object('book', to_jsonb(existing_book), 'created', true);
END;
$$;
REVOKE ALL ON FUNCTION public.create_book_from_upload(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_book_from_upload(text, jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
