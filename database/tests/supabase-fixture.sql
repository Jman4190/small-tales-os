-- ONLY for the disposable PostgreSQL smoke-test cluster. Supabase supplies these
-- roles, auth helpers and Storage tables in a real project. This is not a
-- replacement for Supabase Auth, PostgREST or the Storage service.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_app_meta_data jsonb NOT NULL DEFAULT '{}');
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''), auth.jwt()->>'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth, storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  UNIQUE(bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT ALL ON storage.objects, storage.buckets TO service_role;
INSERT INTO auth.users VALUES
  ('00000000-0000-4000-8000-000000000010', '{}'),
  ('00000000-0000-4000-8000-000000000011', '{"is_admin":true}'),
  ('00000000-0000-4000-8000-000000000012', '{"is_admin":"true"}');
