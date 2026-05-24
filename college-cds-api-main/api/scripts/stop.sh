#!/usr/bin/env bash
# Stop & remove the API container, keep the SQLite volume so data survives.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

compose down
echo "[stop] stopped (SQLite volume preserved)"
