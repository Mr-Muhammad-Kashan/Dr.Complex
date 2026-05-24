#!/usr/bin/env bash
# DESTRUCTIVE: stops the container, deletes the SQLite volume, restarts (re-ingests fixtures).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

if [[ "${FORCE:-0}" != "1" ]]; then
  read -r -p "This will DELETE the SQLite volume and re-ingest fixtures. Continue? [y/N] " ans
  case "$ans" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

compose down -v
bash "$SCRIPT_DIR/start.sh"
