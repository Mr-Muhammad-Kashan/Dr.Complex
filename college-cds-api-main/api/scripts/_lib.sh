#!/usr/bin/env bash
# Common helpers sourced by the other scripts.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$API_DIR"

if [[ -f "$API_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "$API_DIR/.env"; set +a
fi

PORT="${PORT:-8080}"
SERVICE_NAME="api"

compose() {
  docker compose "$@"
}

wait_for_health() {
  local url="http://localhost:${PORT}/v1/health"
  local tries=40
  echo "[start] waiting for $url ..."
  while ((tries > 0)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[start] healthy"
      return 0
    fi
    tries=$((tries - 1))
    sleep 1
  done
  echo "[start] timed out waiting for health endpoint" >&2
  return 1
}
