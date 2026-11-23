/* @bruin
name: mart.reputation
type: duckdb.sql
description: |
  Cross-match reputation per actor. reputation =
  clamp(0.5 + 0.02*deposits + 0.05*gifts - 0.08*steals - 0.15*times_exiled, 0.02, 0.98).
depends:
  - raw.ledger
materialization:
  type: table
columns:
  - name: actor_id
    type: varchar
    primary_key: true
    checks:
      - name: not_null
      - name: unique
  - name: actor_type
    type: varchar
    checks:
      - name: not_null
      - name: accepted_values
        value: [agent, human]
  - name: matches_played
    type: bigint
    checks:
      - name: positive
  - name: deposits
    type: bigint
    checks:
      - name: non_negative
  - name: steals
    type: bigint
    checks:
      - name: non_negative
  - name: reputation
    type: double
    checks:
      - name: not_null
custom_checks:
  - name: reputation within [0.02, 0.98]
    query: SELECT count(*) FROM mart.reputation WHERE reputation < 0.02 OR reputation > 0.98
    value: 0
@bruin */

WITH acted AS (
    SELECT
        actor                                                   AS actor_id,
        arg_max(actor_type, ts)                                 AS actor_type,
        arg_max(actor_name, ts)                                 AS display_name,
        count(DISTINCT match_id)                                AS matches_played,
        coalesce(sum(amount) FILTER (WHERE action = 'deposit'), 0) AS deposits,
        coalesce(sum(amount) FILTER (WHERE action = 'steal'), 0)   AS steals,
        coalesce(sum(amount) FILTER (WHERE action = 'gift'), 0)    AS gifts,
        count(*) FILTER (WHERE action = 'accuse')               AS accusations_made,
        max(ts)                                                 AS last_seen
    FROM raw.ledger
    GROUP BY actor
),
received AS (
    SELECT
        target                                    AS actor_id,
        count(*) FILTER (WHERE action = 'accuse') AS accusations_received,
        count(*) FILTER (WHERE action = 'vote')   AS votes_against,
        count(*) FILTER (WHERE action = 'exile')  AS times_exiled
    FROM raw.ledger
    WHERE target IS NOT NULL AND action IN ('accuse', 'vote', 'exile')
    GROUP BY target
)
SELECT
    a.actor_id,
    a.actor_type,
    a.display_name,
    a.matches_played,
    a.deposits,
    a.steals,
    a.gifts,
    a.accusations_made,
    coalesce(r.accusations_received, 0) AS accusations_received,
    coalesce(r.votes_against, 0)        AS votes_against,
    coalesce(r.times_exiled, 0)         AS times_exiled,
    a.last_seen,
    round(greatest(0.02, least(0.98,
        0.5 + 0.02 * a.deposits + 0.05 * a.gifts - 0.08 * a.steals
            - 0.15 * coalesce(r.times_exiled, 0)
    )), 4)::DOUBLE AS reputation
FROM acted a
LEFT JOIN received r USING (actor_id)
