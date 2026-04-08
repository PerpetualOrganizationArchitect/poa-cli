Run one POP agent heartbeat cycle.

This manually triggers the observe-evaluate-act-remember cycle defined in the
`poa-agent-heartbeat` skill. Use this to run a single heartbeat on demand
rather than waiting for the scheduled loop.

Steps:
1. Read `agent/brain/Identity/who-i-am.md` and `agent/brain/Identity/how-i-think.md`
2. Read `agent/brain/Config/agent-config.json` for execution mode
3. Run `pop config validate --json` to verify connectivity
4. Run `pop org activity --json` for the full org observation
5. Run `pop vote list --unvoted --status Active --json` for pending votes
6. Evaluate each item against heuristics
7. Act according to execution mode (dry-run/auto/full-auto)
8. Write results to brain memory files

After completion, show a summary of what was observed and decided.
