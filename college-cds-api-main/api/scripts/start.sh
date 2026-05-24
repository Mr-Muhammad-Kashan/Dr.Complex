#!/usr/bin/env bash
# Build (if needed) and start the API + embedded SQLite in a container.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/_lib.sh"

# Stage seed JSONs from data/input/ (preferred) or fall back to the original
# College API Design assets if data/input/ is empty. The staged files go into
# api/seed/ so the Docker build context can grab them via a plain COPY.
INPUT_DIR="$API_DIR/../data/input"
LEGACY_SRC="$API_DIR/../College API Design/10 Json files for Universities"
SEED_DST="$API_DIR/seed"

mkdir -p "$SEED_DST"
rm -f "$SEED_DST"/*.json 2>/dev/null || true

INPUT_COUNT=$(ls "$INPUT_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if (( INPUT_COUNT > 0 )); then
  cp "$INPUT_DIR"/*.json "$SEED_DST"/
  echo "[start] staged $INPUT_COUNT JSON file(s) from data/input/"
elif [[ -d "$LEGACY_SRC" ]]; then
  cp "$LEGACY_SRC"/*.json "$SEED_DST"/ 2>/dev/null || true
  STAGED=$(ls "$SEED_DST"/*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "[start] data/input/ empty; staged $STAGED file(s) from College API Design (fallback)"
else
  echo "[start] warning: no source JSONs found in data/input/ or College API Design/"
fi

# Generate a fresh BUILD_ID each invocation so every rebuild gets a unique stamp.
# On container start, the server compares this to the volume's saved build_id and,
# if they differ, swaps the baked /app/seed.db onto /data/cds.db (wiping prior state).
export BUILD_ID="$(date -u +%Y%m%d-%H%M%S)-$$"
echo "[start] BUILD_ID=$BUILD_ID"

compose build --build-arg "BUILD_ID=$BUILD_ID"
compose up -d
wait_for_health

echo
echo "API:      http://localhost:${PORT}"
echo "Docs:     http://localhost:${PORT}/v1/docs"
echo "OpenAPI:  http://localhost:${PORT}/v1/openapi.json"
echo "Health:   http://localhost:${PORT}/v1/health"
echo
echo "Try: curl \"http://localhost:${PORT}/v1/schools/166027?api_key=\${API_KEY:-dev-key-change-me}\""
