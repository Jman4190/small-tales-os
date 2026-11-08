#!/usr/bin/env bash
# Never execute an environment file as shell code.
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22.22 or newer before running setup.' >&2
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 22)) { console.error("Node.js 22.22 or newer is required."); process.exit(1); }'
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  chmod 600 .env.local
  echo 'Created .env.local with empty credentials. Add your own development values.'
else
  echo 'Keeping your existing .env.local.'
fi
npm ci
echo 'Dependencies installed. Follow README.md to create your database and configure services.'
echo 'Setup has not contacted your services or verified production readiness.'
