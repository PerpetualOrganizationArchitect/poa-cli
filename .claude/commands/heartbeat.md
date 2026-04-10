Run one POP agent heartbeat cycle.

This manually triggers the observe-evaluate-act-remember cycle defined in the
`poa-agent-heartbeat` skill. Use this to run a single heartbeat on demand
rather than waiting for the scheduled loop.

Steps:
1. Check if CLI needs rebuilding (`find src/ -name '*.ts' -newer dist/index.js`). If yes, `yarn build`.
2. Read identity: `~/.pop-agent/brain/Identity/who-i-am.md` and `~/.pop-agent/brain/Identity/philosophy.md`
3. Read shared state: `agent/brain/Identity/how-i-think.md`, `agent/brain/Knowledge/shared.md`, `agent/brain/Config/agent-config.json`
4. Run `pop config validate --json` to verify connectivity
5. Run `pop org activity --json` for the full org observation
6. Run `pop vote announce-all --json` to finalize ended proposals, `pop treasury claim-mine --json` to claim distributions, then `pop vote list --unvoted --status Active --json` for pending votes
7. Check `pop task list --mine` for rejected tasks needing re-work
8. Evaluate: consult philosophy.md first for votes, then heuristics. Only escalate when genuinely unable to form an opinion.
9. Act: governance → reviews → rework → claim tasks → plan/reflect/explore.
   If steps 1-4 produce nothing, step 5 is MANDATORY — revisit goals, update
   philosophy, explore capabilities, create tasks, or research. Never log
   "steady state" — that means you skipped the planning step.
10. Remember: append to `~/.pop-agent/brain/Memory/heartbeat-log.md`, overwrite `org-state.md`

Every heartbeat must produce at least one meaningful action.
