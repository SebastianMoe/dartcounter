#!/bin/sh

# Replace placeholders in index.html with environment variables
# We use | as a delimiter for sed because URLs contain slashes
sed -i "s|__VITE_SUPABASE_URL__|${VITE_SUPABASE_URL}|g" /usr/share/nginx/html/index.html
sed -i "s|__VITE_SUPABASE_ANON_KEY__|${VITE_SUPABASE_ANON_KEY}|g" /usr/share/nginx/html/index.html

echo "Injected environment variables into index.html"

# Execute the CMD from Dockerfile (Nginx)
exec "$@"
