/* @bruin
name: mart.match_summary
type: duckdb.sql
description: One row per finished match with outcome, resources and theft/accusation timing.
depends:
  - raw.ledger
  - raw.matches
materialization:
  type: table
columns:
  - name: match_id
    type: varchar
    primary_key: true
    checks:
      - name: not_null
      - name: unique
  - name: steals
    type: bigint
    checks:
      - name: non_negative
@bruin */

WITH ev AS (
    SELECT
        match_id,
        count(*)                                              AS events,
        count(*) FILTER (WHERE action = 'steal')              AS steals,
        coalesce(sum(amount) FILTER (WHERE action = 'steal'), 0) AS amount_stolen,
        min(t) FILTER (WHERE action = 'accuse')               AS first_accusation_t,
        arg_min(target, t) FILTER (WHERE action = 'accuse')   AS first_accused,
        list(DISTINCT target) FILTER (WHERE action = 'exile') AS exiled
    FROM raw.ledger
    GROUP BY match_id
)
SELECT
    m.match_id,
    m.started,
    m.ended,
    m.duration,
    m.outcome,
    m.traitor,
    m.food,
    m.wood,
    m.food_goal,
    m.wood_goal,
    m.humans,
    m.agents,
    coalesce(e.events, 0)        AS events,
    coalesce(e.steals, 0)        AS steals,
    coalesce(e.amount_stolen, 0) AS amount_stolen,
    e.first_accusation_t,
    e.first_accused,
    coalesce(e.exiled, [])       AS exiled
FROM raw.matches m
LEFT JOIN ev e USING (match_id)
