#!/usr/bin/env bash
# Build and deploy docavivplus to Cloudflare Pages.
# Auth comes from gnome-keyring; no env vars need to be set externally.
set -euo pipefail

export CLOUDFLARE_ACCOUNT_ID=$(secret-tool lookup service env key CLOUDFLARE_ACCOUNT_ID)
export CLOUDFLARE_API_TOKEN=$(secret-tool lookup service env key CLOUDFLARE_PAGES_TOKEN)

npm run build
./node_modules/.bin/wrangler pages deploy dist \
  --project-name=docavivplus \
  --branch=main \
  --commit-dirty=true
