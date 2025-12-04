#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR="$PROJECT_ROOT/notifier"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Run ${PROJECT_ROOT}/install_dependencies.sh first." >&2
  exit 1
fi

if [ ! -d "$APP_DIR/node_modules" ]; then
  echo "Node modules not found. Run npm install in $APP_DIR or execute install_dependencies.sh." >&2
  exit 1
fi

if [ ! -f "$APP_DIR/.env" ]; then
  echo "Warning: .env file not found in $APP_DIR. Ensure required environment variables are set." >&2
fi

cd "$APP_DIR"

# Allow callers to override Puppeteer's browser. Try common Chromium paths when none is provided.
if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  for candidate in /usr/bin/chromium /usr/bin/chromium-browser; do
    if [ -x "$candidate" ]; then
      export PUPPETEER_EXECUTABLE_PATH="$candidate"
      break
    fi
  done
fi

if [ -z "${PUPPETEER_EXECUTABLE_PATH:-}" ]; then
  echo "Warning: Could not locate Chromium executable. Set PUPPETEER_EXECUTABLE_PATH to a valid browser." >&2
fi
export PUPPETEER_EXECUTABLE_PATH

npm start
