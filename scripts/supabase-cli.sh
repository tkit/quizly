#!/bin/sh
set -eu

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <local|prod> <supabase args...>" >&2
  exit 1
fi

TARGET="$1"
shift

load_cli_env_file() {
  if [ -f ./.env.supabase.local ]; then
    set -a
    . ./.env.supabase.local
    set +a
  fi
}

require_env() {
  KEY="$1"
  eval "VALUE=\${$KEY:-}"
  if [ -z "$VALUE" ]; then
    echo "Missing required env: $KEY" >&2
    exit 1
  fi
}

ensure_prod_guard() {
  if [ "${ALLOW_SUPABASE_PROD:-0}" != "1" ]; then
    echo "Blocked: prod target requires ALLOW_SUPABASE_PROD=1" >&2
    exit 1
  fi
}

ensure_supabase_project_initialized() {
  if [ ! -f "./supabase/config.toml" ]; then
    npx supabase init
  fi
}

ensure_supabase_linked_to_prod() {
  npx supabase link --project-ref "$SUPABASE_PROJECT_ID"
}

case "$TARGET" in
  local)
    exec npx supabase "$@"
    ;;
  prod)
    ensure_prod_guard
    load_cli_env_file
    require_env SUPABASE_PROJECT_ID
    require_env SUPABASE_ACCESS_TOKEN
    ensure_supabase_project_initialized
    ensure_supabase_linked_to_prod
    exec npx supabase "$@"
    ;;
  *)
    echo "Unknown target: $TARGET" >&2
    echo "Use 'local' or 'prod'" >&2
    exit 1
    ;;
esac
