#!/bin/sh
set -e

# Create/update the PocketBase admin (superuser) on start when credentials are given.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  /pb/pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir /pb/pb_data >/dev/null
  echo "Admin account ready: $PB_ADMIN_EMAIL"
fi

exec /pb/pocketbase serve \
  --http 0.0.0.0:8090 \
  --dir /pb/pb_data \
  --publicDir /pb/pb_public \
  --migrationsDir /pb/pb_migrations \
  --hooksDir /pb/pb_hooks \
  "$@"
