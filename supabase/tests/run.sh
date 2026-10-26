#!/usr/bin/env bash
# Runs the migration, demo seed and security tests against a throwaway
# local PostgreSQL instance. Usage: npm run test:db
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
export PATH="$PG_BIN:$PATH"

DATA="$(mktemp -d)"
SOCK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
cleanup() {
  pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA" "$SOCK"
}
trap cleanup EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # postgres refuses to run as root
  chown -R postgres "$DATA" "$SOCK"
  RUN_AS=(runuser -u postgres --)
fi

"${RUN_AS[@]}" initdb -D "$DATA" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" pg_ctl -D "$DATA" -o "-k $SOCK -p $PORT -c listen_addresses=''" -w start >/dev/null

PSQL=(psql -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -c "create database app" >/dev/null
DB=("${PSQL[@]}" -d app)

"${DB[@]}" -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${DB[@]}" -f "$f"
done
echo "→ demo seed"
"${DB[@]}" -f "$ROOT/supabase/seed_demo.sql"
echo "→ tests"
"${DB[@]}" -f "$HERE/rls_test.sql"
echo "✓ database tests passed"
