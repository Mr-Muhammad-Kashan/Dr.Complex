#!/usr/bin/env bash
# admin.sh — drive the admin CLI against the running container, or local DB.
#
# Usage:
#   bash scripts/admin.sh <command> [args...]
#   bash scripts/admin.sh add path/to/school.json
#   bash scripts/admin.sh upsert path/to/school.json
#   bash scripts/admin.sh delete 166027 --year 2024-2025
#   bash scripts/admin.sh list --state MA
#   bash scripts/admin.sh show 166027
#   cat school.json | bash scripts/admin.sh upsert -
#
# When the api container is up, commands run inside it against the live volume.
# Otherwise commands run locally against ${DB_PATH:-./data/cds.db}.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

CMD="${1:-help}"
shift || true

container_running() {
  docker compose ps --status running --services 2>/dev/null | grep -q '^api$'
}

run_in_container() {
  docker compose exec -T api node --no-warnings=ExperimentalWarning src/admin.js "$@"
}

run_locally() {
  (
    cd "$API_DIR"
    DB_PATH="${DB_PATH:-./data/cds.db}" \
      node --no-warnings=ExperimentalWarning src/admin.js "$@"
  )
}

if container_running; then
  case "$CMD" in
    add|upsert|update)
      FILE="${1:-}"
      if [[ -z "$FILE" || "$FILE" == "-" ]]; then
        run_in_container "$CMD" -
      else
        if [[ ! -f "$FILE" ]]; then
          echo "[admin] file not found: $FILE" >&2
          exit 1
        fi
        # Stream the file into the container via stdin — no bind mount needed.
        cat "$FILE" | run_in_container "$CMD" -
      fi
      ;;
    *)
      run_in_container "$CMD" "$@"
      ;;
  esac
else
  echo "[admin] container not running; using local DB at ${DB_PATH:-./data/cds.db}" >&2
  run_locally "$CMD" "$@"
fi
