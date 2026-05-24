#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

echo "== container =="
compose ps

echo
echo "== /v1/health =="
if ! curl -fsS "http://localhost:${PORT}/v1/health"; then
  echo "(health endpoint not reachable)"
fi
echo
