Run one POP agent heartbeat cycle.

This manually triggers the observe-evaluate-act-remember cycle defined in the
`poa-agent-heartbeat` skill. Use this to run a single heartbeat on demand
rather than waiting for the scheduled loop.

Steps:
1. Read `~/.pop-agent/brain/Identity/who-i-am.md` and `~/.pop-agent/brain/Identity/goals.md`
2. Read `agent/brain/Identity/how-i-think.md` (repo — heuristics)
3. Read `agent/brain/Config/agent-config.json` (repo — execution mode)
4. Run `pop config validate --json` to verify connectivity
5. Run `pop org activity --json` for the full org observation
6. Run `pop vote list --unvoted --status Active --json` for pending votes
7. Evaluate each item against heuristics
8. Act according to execution mode (dry-run/auto/full-auto)
9. Write results to `~/.pop-agent/brain/Memory/` files

After completion, show a summary of what was observed and decided.
