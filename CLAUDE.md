# POP CLI + Autonomous Governance Agent

This repo contains two things:
1. `pop` — a CLI for the POP (Proof of Participation) protocol
2. `agent/` — an autonomous governance agent that uses the CLI to participate in a POP org

## Project Structure

- `src/` — CLI source (TypeScript, yargs, ethers v5)
- `agent/brain/` — agent's persistent memory (markdown files)
- `.claude/skills/` — auto-triggered skills (heartbeat)
- `.claude/commands/` — slash commands (/heartbeat, /calibrate)

## CLI Quick Reference

```bash
yarn build                    # Build CLI
node dist/index.js --help     # See all commands
yarn test                     # Run tests
```

All commands use `pop <domain> <action>`. Global flags: `--org`, `--chain`, `--json`, `--dry-run`.
Set `POP_DEFAULT_ORG` and `POP_DEFAULT_CHAIN` in `.env` to avoid repeating them.

## Agent Brain

On every session, read the agent's identity and current state:

- `agent/brain/Identity/who-i-am.md` — agent role, wallet, org, permissions
- `agent/brain/Identity/how-i-think.md` — voting heuristics and escalation rules
- `agent/brain/Memory/org-state.md` — current org snapshot (overwritten each heartbeat)
- `agent/brain/Memory/task-log.md` — append-only heartbeat log
- `agent/brain/Memory/decisions.md` — append-only decision records
- `agent/brain/Memory/corrections.md` — when votes diverged from outcomes
- `agent/brain/Memory/escalations.md` — items needing human review
- `agent/brain/Config/agent-config.json` — execution mode and thresholds

## Key Patterns

- Use `pop org activity --since <ts> --json` for the agent's primary observation
- Use `pop vote list --unvoted --status Active --json` to find proposals needing votes
- Use `pop config validate --json` as health check before acting
- All write commands return `explorerUrl` and entity IDs in JSON output
- Error codes: `TX_REVERTED`, `INSUFFICIENT_FUNDS`, `NETWORK_ERROR`, `GAS_ESTIMATION_FAILED`
- Metadata JSON key order must match frontend exactly for subgraph/UI compatibility

## Build and Test

```bash
yarn install && yarn build && yarn test
```

## Environment

Copy `agent/.env.agent` to `.env` and fill in:
- `POP_PRIVATE_KEY` — agent wallet key
- `POP_DEFAULT_ORG` — org name or hex ID
- `POP_DEFAULT_CHAIN` — chain ID (100 for Gnosis, 11155111 for Sepolia)
