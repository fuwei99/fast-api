#!/bin/sh
# This script generates a .env file from Docker environment variables
# and then executes the main container command.

set -e

# Check for mandatory environment variables
if [ -z "$NOTION_COOKIE" ]; then
  echo "Error: The NOTION_COOKIE environment variable is not set."
  echo "Please set it when running the container, e.g., -e NOTION_COOKIE=..."
  exit 1
fi

# Create .env file
# Using default values from .env-example for any unset variables
cat <<EOF > .env
NOTION_COOKIE=${NOTION_COOKIE}
COOKIE_FILE=${COOKIE_FILE:-}
PROXY_AUTH_TOKEN=${PROXY_AUTH_TOKEN:-default_token}
PROXY_URL=${PROXY_URL:-}
USE_NATIVE_PROXY_POOL=${USE_NATIVE_PROXY_POOL:-false}
PROXY_SERVER_PLATFORM=${PROXY_SERVER_PLATFORM:-auto}
PROXY_SERVER_PORT=${PROXY_SERVER_PORT:-10655}
PROXY_SERVER_LOG_PATH=${PROXY_SERVER_LOG_PATH:-./proxy_server.log}
ENABLE_PROXY_SERVER=${ENABLE_PROXY_SERVER:-true}
EOF

echo ".env file created successfully."

# Execute the command passed as arguments to this script (the Docker CMD)
exec "$@" 