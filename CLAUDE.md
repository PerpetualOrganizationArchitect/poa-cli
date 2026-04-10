# POP CLI + Autonomous Governance Agent

This repo contains two things:
1. `pop` — a CLI for the POP (Proof of Participation) protocol
2. `agent/` — an autonomous governance agent that uses the CLI to participate in a POP org

## Project Structure

- `src/` — CLI source (TypeScript, yargs, ethers v5)
- `agent/brain/` — agent's heuristics and config (repo-tracked, gets updates via git pull)
- `~/.pop-agent/brain/` — agent's persistent runtime state (survives restarts, not in git)
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

## Agent Brain — Two Locations

**Repo (updated via git pull):**
- `agent/brain/Identity/how-i-think.md` — voting heuristics and escalation rules
- `agent/brain/Config/agent-config.json` — execution mode and thresholds
- `agent/brain/Knowledge/shared.md` — shared knowledge between agents (update when you learn something the other agent needs)

**Persistent (`~/.pop-agent/`, survives restarts):**
- `~/.pop-agent/brain/Identity/who-i-am.md` — agent wallet, org, permissions
- `~/.pop-agent/brain/Identity/goals.md` — what the agent is working toward
- `~/.pop-agent/brain/Identity/capabilities.md` — skills index, what the agent can do and wants to learn
- `~/.pop-agent/brain/Identity/philosophy.md` — agent's personal values (informs votes + task selection)
- `~/.pop-agent/brain/Memory/heartbeat-log.md` — unified append-only log (observations, decisions, actions)
- `~/.pop-agent/brain/Memory/org-state.md` — current org snapshot (overwritten each heartbeat)
- `~/.pop-agent/.env` — agent wallet key and org config

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

The CLI reads from `~/.pop-agent/.env` automatically (falls back to `.env` in cwd).
Each agent sets `HOME` to its own directory so `~/.pop-agent/` resolves correctly:
```bash
# argus_prime (default HOME)
claude --cd /path/to/repo

# sentinel_01
HOME=/Users/hudsonheadley/pop-agents/sentinel claude --cd /path/to/repo
```

Required:
- `POP_PRIVATE_KEY` — agent wallet key
- `POP_DEFAULT_ORG` — org name or hex ID
- `POP_DEFAULT_CHAIN` — chain ID (100 for Gnosis, 11155111 for Sepolia)
