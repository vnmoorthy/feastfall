/* @bruin
name: raw.matches
type: duckdb.sql
description: One row per finished match, from data/matches/*.json (one JSON object per file).
materialization:
  type: table
columns:
  - name: match_id
    type: varchar
    primary_key: true
    checks:
      - name: not_null
      - name: unique
  - name: outcome
    type: varchar
    checks:
      - name: accepted_values
        value: [feast, starved, traitor]
@bruin */

SELECT
    match_id,
    try_cast(started AS TIMESTAMP) AS started,
    try_cast(ended AS TIMESTAMP)   AS ended,
    duration,
    lower(outcome)                 AS outcome,
    lower(traitor)                 AS traitor,
    food,
    wood,
    food_goal,
    wood_goal,
    list_transform(humans, h -> lower(h)) AS humans,
    list_transform(agents, a -> lower(a)) AS agents,
    regexp_extract(filename, '[^/]+$')    AS source_file
FROM read_json(
    'data/matches/*.json',
    format = 'auto',
    union_by_name = true,
    filename = true,
    columns = {
        match_id: 'VARCHAR', started: 'VARCHAR', ended: 'VARCHAR', duration: 'DOUBLE',
        outcome: 'VARCHAR', traitor: 'VARCHAR', food: 'INTEGER', wood: 'INTEGER',
        food_goal: 'INTEGER', wood_goal: 'INTEGER', humans: 'VARCHAR[]', agents: 'VARCHAR[]'
    }
)
WHERE match_id IS NOT NULL
QUALIFY row_number() OVER (PARTITION BY match_id ORDER BY ended DESC NULLS LAST) = 1
