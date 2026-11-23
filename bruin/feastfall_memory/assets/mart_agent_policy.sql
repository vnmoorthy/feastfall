/* @bruin
name: mart.agent_policy
type: duckdb.sql
description: |
  Learned prior per (agent, action): how often it was used, its mean self-reported
  utility, and win_rate = share of finished matches using that action that ended in 'feast'.
  Matches without a match file yet (still running) are excluded from win_rate.
depends:
  - raw.ledger
  - raw.matches
materialization:
  type: table
columns:
  - name: actor_id
    type: varchar
    checks:
      - name: not_null
  - name: action
    type: varchar
    checks:
      - name: not_null
  - name: action_count
    type: bigint
    checks:
      - name: positive
custom_checks:
  - name: one row per (actor_id, action)
    query: SELECT count(*) - count(DISTINCT (actor_id, action)) FROM mart.agent_policy
    value: 0
  - name: win_rate within [0, 1]
    query: SELECT count(*) FROM mart.agent_policy WHERE win_rate < 0 OR win_rate > 1
    value: 0
@bruin */

WITH uses AS (
    SELECT actor AS actor_id, action, count(*) AS action_count, avg(utility) AS avg_utility
    FROM raw.ledger
    WHERE actor_type = 'agent'
    GROUP BY 1, 2
),
per_match AS (
    SELECT DISTINCT l.actor AS actor_id, l.action, l.match_id, m.outcome
    FROM raw.ledger l
    LEFT JOIN raw.matches m USING (match_id)
    WHERE l.actor_type = 'agent'
)
SELECT
    u.actor_id,
    u.action,
    u.action_count,
    round(u.avg_utility, 4)::DOUBLE AS avg_utility,
    count(DISTINCT p.match_id) FILTER (WHERE p.outcome IS NOT NULL) AS finished_matches_used,
    round(avg(CASE WHEN p.outcome IS NULL THEN NULL
                   WHEN p.outcome = 'feast' THEN 1.0 ELSE 0.0 END), 4)::DOUBLE AS win_rate
FROM uses u
JOIN per_match p USING (actor_id, action)
GROUP BY u.actor_id, u.action, u.action_count, u.avg_utility
