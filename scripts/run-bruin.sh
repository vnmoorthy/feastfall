#!/usr/bin/env bash
# Rebuild FEASTFALL agent memory with Bruin + DuckDB:
#   data/ledger/*.jsonl + data/matches/*.json -> data/feastfall.duckdb -> data/memory/reputation.json
# Usage: scripts/run-bruin.sh [extra bruin run flags, e.g. --full-refresh]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Asset SQL uses paths relative to the project root (data/...), so always run from there.
cd "$ROOT"

if ! command -v bruin >/dev/null 2>&1; then
  echo "run-bruin: bruin CLI not found. Install: brew install bruin-data/tap/bruin" >&2
  exit 127
fi

# Bruin locates projects via a git repository; create a local one if none exists.
if ! git -C "$ROOT/bruin" rev-parse --show-toplevel >/dev/null 2>&1; then
  git init -q "$ROOT/bruin"
fi

mkdir -p data/ledger data/matches data/memory
if ! compgen -G "data/ledger/*.jsonl" >/dev/null || ! compgen -G "data/matches/*.json" >/dev/null; then
  echo "run-bruin: need at least one data/ledger/*.jsonl and one data/matches/*.json" >&2
  exit 1
fi

bruin run --config-file "$ROOT/bruin/.bruin.yml" "$@" "$ROOT/bruin/feastfall_memory"

OUT="$ROOT/data/memory/reputation.json"
if [ ! -s "$OUT" ]; then
  echo "run-bruin: pipeline finished but $OUT is missing or empty" >&2
  exit 1
fi
if command -v node >/dev/null 2>&1; then
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));if(!d.actors||!d.policy||!Array.isArray(d.matches))process.exit(1);console.log("run-bruin: reputation.json OK ("+Object.keys(d.actors).length+" actors, "+d.matches.length+" matches)")' "$OUT" \
    || { echo "run-bruin: $OUT is not valid memory JSON" >&2; exit 1; }
fi
