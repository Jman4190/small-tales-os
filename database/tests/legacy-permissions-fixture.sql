-- Simulate the unsafe policies/grants an existing installation may contain.
-- Tests run only in the disposable cluster, immediately before hardening.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'books', 'orders', 'book_photos', 'reminders', 'book_approvals', 'book_logs',
    'email_logs', 'gelato_logs', 'upload_attempt_logs', 'course_signups'
  ] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO PUBLIC', table_name);
    EXECUTE format('CREATE POLICY legacy_open_access ON public.%I FOR ALL TO PUBLIC USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END;
$$;
CREATE POLICY legacy_open_storage ON storage.objects FOR SELECT TO PUBLIC USING (true);
