# FEASTFALL memory pipeline (Bruin + DuckDB)

Turns raw match ledgers into the cross-match memory the agents load at match start
(`data/memory/reputation.json`). Pipeline: `feastfall_memory`, connection `duckdb-feastfall`
-> `data/feastfall.duckdb`.

## Run

```bash
scripts/run-bruin.sh                 # from anywhere; cds to the project root itself
scripts/run-bruin.sh --full-refresh  # extra flags are passed to `bruin run`
# manual equivalent, from the project root:
bruin validate --config-file bruin/.bruin.yml bruin/feastfall_memory
bruin run      --config-file bruin/.bruin.yml bruin/feastfall_memory
```

Install the CLI with `brew install bruin-data/tap/bruin`.

## Assets

| Asset | What it does |
|---|---|
| `raw.ledger` | Every event from `data/ledger/*.jsonl` (explicit schema, `union_by_name`, skips half-written lines). Checks: not_null match_id/actor/action, accepted_values on action and actor_type (agent, human). |
| `raw.matches` | One row per `data/matches/*.json`, deduped on match_id. Checks: unique match_id, accepted outcome. |
| `mart.reputation` | Per actor: type, name, matches_played, deposits, steals, gifts, accusations made/received, votes_against, times_exiled, last_seen, and `reputation = clamp(0.5 + 0.02*deposits + 0.05*gifts - 0.08*steals - 0.15*times_exiled, 0.02, 0.98)`. |
| `mart.agent_policy` | Per (agent, action): count, avg utility, win_rate = share of finished matches using that action that ended in `feast`. A learned prior. |
| `mart.match_summary` | Per match: outcome, traitor, food, wood, duration, steal count, amount stolen, first accusation time and target, who was exiled. |
| `memory.export_reputation_json` | A DuckDB `COPY` that writes `data/memory/reputation.json`: `{generated_at, actors{}, policy{}, matches[last 10]}`. |

## Lineage

```
raw.ledger ──┬──────────────> mart.reputation ─────┐
             ├──> mart.agent_policy  <──┐          ├──> memory.export_reputation_json
raw.matches ─┴──> mart.match_summary <──┘ ─────────┘
```

## Notes

- The DuckDB path in `.bruin.yml` resolves relative to `bruin/`; the file paths inside the SQL
  resolve relative to the working directory, which is why the script runs from the project root.
- Bruin needs a git repository to find the project. The script runs `git init` in `bruin/` when
  there isn't one.
- DuckDB allows only one writer at a time. Don't keep `data/feastfall.duckdb` open while the
  pipeline runs. The game server should read `reputation.json`, not the database.
