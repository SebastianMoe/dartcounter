#!/bin/sh

# Logging for debugging
echo "Starting entrypoint script..."
echo "VITE_SUPABASE_URL is set to: ${VITE_SUPABASE_URL:-'NOT SET'}"

if [ -z "${VITE_SUPABASE_URL}" ] || [ -z "${VITE_SUPABASE_ANON_KEY}" ]; then
  echo "WARNING: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing!"
fi

# Replace placeholders in index.html
# Use '|' as delimiter to handle slashes in URLs
sed -i "s|__VITE_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" /usr/share/nginx/html/index.html
sed -i "s|__VITE_SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" /usr/share/nginx/html/index.html

echo "Environment injection complete. Starting Nginx..."

# Execute the CMD from Dockerfile
exec "$@"
