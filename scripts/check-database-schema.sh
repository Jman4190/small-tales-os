#!/usr/bin/env bash
set -euo pipefail
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
export PGCONNECT_TIMEOUT=5

# Always creates its own throwaway cluster. Never reads DATABASE_URL or connects
# to an existing database. PG_BIN can point at an installed PostgreSQL bin dir.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pg_bin="${PG_BIN:-}"
if [[ -z "$pg_bin" ]]; then
  if [[ -x /opt/homebrew/opt/postgresql@17/bin/initdb ]]; then
    pg_bin=/opt/homebrew/opt/postgresql@17/bin
  elif command -v initdb >/dev/null 2>&1; then
    pg_bin="$(dirname "$(command -v initdb)")"
  elif [[ -x /opt/homebrew/opt/postgresql/bin/initdb ]]; then
    pg_bin=/opt/homebrew/opt/postgresql/bin
  else
    echo 'PostgreSQL initdb is required. Set PG_BIN to your PostgreSQL bin directory.' >&2
    exit 1
  fi
fi
for binary in initdb pg_ctl psql; do
  [[ -x "$pg_bin/$binary" ]] || { echo "Missing $pg_bin/$binary" >&2; exit 1; }
done

check_dir="$(mktemp -d /tmp/smalltales-schema.XXXXXX)"
cleanup() {
  "$pg_bin/pg_ctl" -D "$check_dir/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf -- "$check_dir"
}
trap cleanup EXIT
mkdir "$check_dir/socket"
initdb_args=()
# A keg-only Homebrew installation can coexist with an older linked version.
if [[ -f "$pg_bin/../share/postgresql/postgres.bki" ]]; then
  initdb_args=(-L "$pg_bin/../share/postgresql")
fi
"$pg_bin/initdb" "${initdb_args[@]}" -D "$check_dir/data" -U schema_check --auth=trust --no-locale --encoding=UTF8 >/dev/null
"$pg_bin/pg_ctl" -D "$check_dir/data" -l "$check_dir/server.log" \
  -o "-F -c listen_addresses='' -k $check_dir/socket -p 55432" -w start >/dev/null
psql_args=(-X -v ON_ERROR_STOP=1 -h "$check_dir/socket" -p 55432 -U schema_check -d postgres)
run_sql() {
  if ! "$pg_bin/psql" "${psql_args[@]}" -f "$1" >"$check_dir/result.log" 2>&1; then
    cat "$check_dir/result.log" >&2
    exit 1
  fi
}
run_sql "$repo_dir/database/tests/supabase-fixture.sql"
run_sql "$repo_dir/database/supabase_table_schema.sql"
run_sql "$repo_dir/database/tests/schema-smoke.sql"
echo 'Fresh schema: table writes, approval trigger, upserts, duplicate protection and access checks passed.'
if [[ -f "$repo_dir/database/2026-11-07-release-hardening.sql" ]]; then
  run_sql "$repo_dir/database/tests/legacy-permissions-fixture.sql"
  run_sql "$repo_dir/database/2026-11-07-release-hardening.sql"
  # Repeat once to verify migration idempotence on an existing installation.
  run_sql "$repo_dir/database/2026-11-07-release-hardening.sql"
  run_sql "$repo_dir/database/tests/schema-smoke.sql"
  run_sql "$repo_dir/database/tests/hardening-smoke.sql"
  echo 'Hardened schema: legacy grants, anonymous/customer/admin separation, revocation and RPC permissions passed.'

  pids=()
  for n in {1..24}; do
    "$pg_bin/psql" "${psql_args[@]}" -qAt \
      -c "SET ROLE service_role; SELECT public.consume_rate_limit(repeat('c', 64), 7, 60)->>'allowed';" \
      >"$check_dir/rate-$n.log" 2>&1 &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      cat "$check_dir"/rate-*.log >&2
      exit 1
    fi
  done
  allowed_count="$(awk '$0 == "true" {count++} END {print count+0}' "$check_dir"/rate-*.log)"
  [[ "$allowed_count" == 7 ]] || { echo "Concurrent limit failed: allowed $allowed_count of 24 requests, expected 7." >&2; exit 1; }
  echo 'Concurrent rate limit: exactly 7 of 24 simultaneous requests allowed.'
fi

if [[ -f "$repo_dir/database/2026-11-07-book-creation.sql" ]]; then
  run_sql "$repo_dir/database/2026-11-07-book-creation.sql"
  run_sql "$repo_dir/database/2026-11-07-book-creation.sql"
  run_sql "$repo_dir/database/tests/book-creation-smoke.sql"
  echo 'Upload creation: input validation, server-only permissions, retry identity and transaction rollback passed.'
  pids=()
  for n in {1..24}; do
    "$pg_bin/psql" "${psql_args[@]}" -qAt \
      -f "$repo_dir/database/tests/concurrent-book-creation.sql" \
      >"$check_dir/creation-$n.log" 2>&1 &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      cat "$check_dir"/creation-*.log >&2
      exit 1
    fi
  done
  created_count="$(awk -F '|' '$2 == "true" {count++} END {print count+0}' "$check_dir"/creation-*.log)"
  book_count="$(awk -F '|' 'NF == 2 {books[$1]=1} END {for (book in books) count++; print count+0}' "$check_dir"/creation-*.log)"
  [[ "$created_count" == 1 && "$book_count" == 1 ]] || {
    echo "Concurrent upload creation failed: $created_count creations with $book_count IDs." >&2
    exit 1
  }
  database_counts="$("$pg_bin/psql" "${psql_args[@]}" -qAt -c \
    "SELECT (SELECT count(*) FROM public.books WHERE original_image_url = 'uploads/concurrent.jpg'), (SELECT count(*) FROM private.upload_creations WHERE key = repeat('f', 64));")"
  [[ "$database_counts" == '1|1' ]] || { echo "Concurrent upload left unexpected book/mapping counts: $database_counts" >&2; exit 1; }
  echo 'Concurrent upload creation: 24 simultaneous retries returned one book with exactly one creation.'
fi
