/* @bruin
name: memory.export_reputation_json
type: duckdb.sql
description: |
  Writes data/memory/reputation.json (single JSON object) that the game server loads
  as the agents' cross-match memory. No materialization: the body is a DuckDB COPY.
depends:
  - mart.reputation
  - mart.agent_policy
  - mart.match_summary
@bruin */

COPY (
    SELECT
        strftime(make_timestamp(epoch_us(get_current_timestamp())), '%Y-%m-%dT%H:%M:%SZ') AS generated_at,
        coalesce((
            SELECT json_group_object(actor_id, json_object(
                'name', display_name, 'type', actor_type, 'reputation', reputation,
                'steals', steals, 'deposits', deposits, 'gifts', gifts,
                'times_exiled', times_exiled, 'matches_played', matches_played,
                'accusations_made', accusations_made,
                'accusations_received', accusations_received,
                'votes_against', votes_against,
                'last_seen', strftime(last_seen, '%Y-%m-%dT%H:%M:%SZ')))
            FROM mart.reputation
        ), '{}'::JSON) AS actors,
        coalesce((
            SELECT json_group_object(actor_id, actions)
            FROM (
                SELECT actor_id, json_group_object(action, json_object(
                    'count', action_count, 'avg_utility', avg_utility, 'win_rate', win_rate)) AS actions
                FROM mart.agent_policy
                GROUP BY actor_id
            )
        ), '{}'::JSON) AS policy,
        coalesce((
            SELECT json_group_array(json_object(
                'match_id', match_id,
                'started', strftime(started, '%Y-%m-%dT%H:%M:%SZ'),
                'ended', strftime(ended, '%Y-%m-%dT%H:%M:%SZ'),
                'duration', duration, 'outcome', outcome, 'traitor', traitor,
                'food', food, 'wood', wood, 'food_goal', food_goal, 'wood_goal', wood_goal,
                'steals', steals, 'amount_stolen', amount_stolen,
                'first_accusation_t', first_accusation_t, 'first_accused', first_accused,
                'exiled', exiled, 'humans', humans, 'agents', agents))
            FROM (
                SELECT * FROM mart.match_summary
                ORDER BY coalesce(ended, started) DESC NULLS LAST
                LIMIT 10
            )
        ), '[]'::JSON) AS matches
) TO 'data/memory/reputation.json' (FORMAT JSON);
