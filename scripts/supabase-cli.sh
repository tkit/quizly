#!/bin/sh
set -eu

if [ -f ./.env.supabase.local ]; then
  set -a
  . ./.env.supabase.local
  set +a
fi

exec npx supabase "$@"
