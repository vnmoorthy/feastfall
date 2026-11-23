/* @bruin
name: raw.ledger
type: duckdb.sql
description: |
  Every event from every match ledger (data/ledger/*.jsonl, one JSON event per line).
  Explicit column schema so files missing a key still union cleanly; ignore_errors
  tolerates a half-written trailing line from a match that is still being recorded.
materialization:
  type: table
columns:
  - name: match_id
    type: varchar
    checks:
      - name: not_null
  - name: actor
    type: varchar
    description: lowercased actor id
    checks:
      - name: not_null
  - name: action
    type: varchar
    checks:
      - name: not_null
      - name: accepted_values
        value: [gather, deposit, steal, eat, gift, accuse, vote, exile, ignite, extinguish, council, speak, join, witness, deceive, stash, role, "decide:accuse", "decide:council", "decide:ignite", "decide:steal", "decide:extinguish", "decide:gift"]
  - name: actor_type
    type: varchar
    checks:
      - name: not_null
      - name: accepted_values
        value: [agent, human]
  - name: amount
    type: integer
    checks:
      - name: non_negative
@bruin */

SELECT
    match_id,
    t,
    try_cast(ts AS TIMESTAMP)       AS ts,
    lower(trim(actor))              AS actor,
    coalesce(actor_name, actor)     AS actor_name,
    lower(actor_type)               AS actor_type,
    lower(action)                   AS action,
    nullif(lower(trim(target)), '') AS target,
    coalesce(amount, 0)             AS amount,
    reason,
    utility,
    x,
    z,
    regexp_extract(filename, '[^/]+$') AS source_file
FROM read_json(
    'data/ledger/*.jsonl',
    format = 'newline_delimited',
    union_by_name = true,
    filename = true,
    ignore_errors = true,
    columns = {
        match_id: 'VARCHAR', t: 'DOUBLE', ts: 'VARCHAR', actor: 'VARCHAR',
        actor_name: 'VARCHAR', actor_type: 'VARCHAR', action: 'VARCHAR',
        target: 'VARCHAR', amount: 'INTEGER', reason: 'VARCHAR',
        utility: 'DOUBLE', x: 'DOUBLE', z: 'DOUBLE'
    }
)
WHERE match_id IS NOT NULL AND actor IS NOT NULL AND action IS NOT NULL
