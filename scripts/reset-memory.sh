#!/usr/bin/env bash
# Reset FEASTFALL memory to the seeded demo state (keeps the two sample matches where "moorthy" stole 6 food).
# Removes only game-generated match files (m_*), the learned policy, and rebuilds memory with Bruin.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
find data/ledger -name 'match-m_*.jsonl' -type f -delete
find data/matches -name 'm_*.json' -type f -delete
rm -f data/memory/policy.json data/feastfall.duckdb data/feastfall.duckdb.wal
bash scripts/run-bruin.sh --full-refresh
echo "reset-memory: back to the seeded demo memory. Restart the server (npm start) to reload it."
