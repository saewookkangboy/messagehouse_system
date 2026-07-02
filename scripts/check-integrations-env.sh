#!/usr/bin/env bash
# OAuth 연동 환경변수 점검
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "❌ .env 파일이 없어요. cp .env.example .env 후 다시 실행하세요."
  exit 1
fi

# shellcheck disable=SC1091
source .env 2>/dev/null || true

ok=0
warn=0

check() {
  local name=$1 val=${!1:-}
  if [[ -n "$val" ]]; then
    echo "✅ $name"
    ok=$((ok + 1))
  else
    echo "⚠️  $name — 비어 있음"
    warn=$((warn + 1))
  fi
}

echo "=== MessageHouse Export 연동 점검 ==="
check AUTH_DISABLED
check INTEGRATION_TOKEN_SECRET
check GOOGLE_CLIENT_ID
check GOOGLE_CLIENT_SECRET
check NOTION_CLIENT_ID
check NOTION_CLIENT_SECRET

echo ""
echo "리디렉션 URI (OAuth 앱에 등록):"
echo "  http://localhost:3000/api/integrations/google/callback"
echo "  http://localhost:3000/api/integrations/notion/callback"
echo ""
echo "Notion Export DB ID: f246b7ad3edb4203be2c29cbdbb4ccb6"
echo "가이드: docs/integrations-oauth-setup.md"

if [[ "$warn" -gt 0 ]]; then
  exit 1
fi
