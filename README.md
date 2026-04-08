# pop — POP Protocol CLI

Command-line interface for the [POP (Proof of Participation)](https://poa.community) protocol. Manage organizations, tasks, voting, education, and membership from the terminal. Designed for both AI agents and humans.

All metadata and contract calls are byte-identical to the POP frontend, so anything created via the CLI renders correctly in the web UI.

## Quick Start

```bash
# Install
yarn install

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set POP_PRIVATE_KEY and POP_DEFAULT_CHAIN

# Build
yarn build

# Verify
node dist/index.js --help
```

## Configuration

The CLI reads from `.env` (via dotenv). Flags override env vars for one-off operations.

```bash
# Required
POP_PRIVATE_KEY=0x...           # Wallet private key for signing transactions
POP_DEFAULT_CHAIN=100           # Default chain ID

# Default org — avoids passing --org on every command
POP_DEFAULT_ORG=My DAO          # Org name or hex ID (0xabc...)

# Optional — override built-in RPC/subgraph defaults
POP_RPC_URL=https://...         # RPC for default chain
POP_SUBGRAPH_URL=https://...    # Subgraph for default chain

# Per-chain overrides (used when --chain differs from default)
POP_ARBITRUM_RPC=https://...
POP_GNOSIS_RPC=https://...
POP_SEPOLIA_RPC=https://...
```

With `POP_DEFAULT_ORG` set, you can skip `--org` on every command:

```bash
# These are equivalent when POP_DEFAULT_ORG="My DAO"
pop task list --org "My DAO"
pop task list

# Override for a one-off command against a different org
pop task list --org "Other DAO"
```

**Supported chains:** Arbitrum (42161), Gnosis (100), Sepolia (11155111), Base Sepolia (84532)

## Usage

Every command follows `pop <domain> <action> [flags]`. Pass `--help` to any command for full flag docs.

### Global Flags

| Flag | Description |
|------|-------------|
| `--org <id\|name>` | Organization (or set `POP_DEFAULT_ORG`) |
| `--chain <id>` | Override chain ID for this command |
| `--json` | Output structured JSON (for scripts/agents) |
| `--dry-run` | Simulate transaction without sending |
| `--private-key <hex>` | Override wallet key for this command |
| `--rpc <url>` | Override RPC endpoint |
| `-y, --yes` | Skip confirmations |

---

### Tasks

The full task lifecycle: create, claim, submit, review.

```bash
# List all tasks in an org
pop task list --org 0xabc...

# Filter shortcuts
pop task list --open              # Open tasks only
pop task list --for-review        # Submitted, awaiting review
pop task list --mine              # Tasks assigned to me
pop task list --status Open       # Explicit status filter
pop task list --sort-by payout    # Sort by payout (also: id, status, created)
pop task list --limit 10          # Cap results

# View task details (fetches IPFS metadata)
pop task view --org 0xabc... --task 5

# Create a task
pop task create \
  --org 0xabc... \
  --project 0xdef... \
  --name "Build landing page" \
  --description "Design and implement the new landing page" \
  --payout 10 \
  --difficulty medium \
  --est-hours 8

# Create a task with an ERC20 bounty
pop task create \
  --org 0xabc... \
  --project 0xdef... \
  --name "Security audit" \
  --description "Audit the smart contracts" \
  --payout 50 \
  --bounty-token 0xDDAfbb505ad214D7b80b1f830fcCc89B60fB7A83 \
  --bounty-amount 500 \
  --requires-application

# Claim an open task
pop task claim --org 0xabc... --task 5

# Apply for a task that requires application
pop task apply --org 0xabc... --task 5 --notes "I have 3 years of React experience"

# Approve an application
pop task approve-app --org 0xabc... --task 5 --applicant 0x1234...

# Assign a task to someone
pop task assign --org 0xabc... --task 5 --assignee 0x1234...

# Submit work
pop task submit --org 0xabc... --task 5 --submission "PR merged: https://github.com/..."

# Approve submitted work (mints PT reward + transfers bounty)
pop task review --org 0xabc... --task 5 --action approve

# Reject submitted work (sends task back to assignee)
pop task review --org 0xabc... --task 5 --action reject --reason "Missing unit tests"

# Cancel an unclaimed task
pop task cancel --org 0xabc... --task 5

# Batch create tasks from a JSONL file
pop task create-batch --project 0xdef... --file tasks.jsonl
pop task create-batch --project 0xdef... --file tasks.jsonl --continue-on-error
# Each line: {"name":"Task 1","description":"...","payout":10,"difficulty":"medium"}
```

### Projects

Projects group tasks under a shared PT budget.

```bash
# List projects
pop project list --org 0xabc...

# Create a project
pop project create \
  --org 0xabc... \
  --name "Website Redesign" \
  --cap 1000 \
  --description "Full website overhaul"

# Delete a project
pop project delete --org 0xabc... --project 0xdef...
```

### Organizations

```bash
# List orgs across all chains
pop org list

# List orgs on a specific chain
pop org list --chain 100

# List orgs where you're a member
pop org list --member 0x1234...

# View full org details
pop org view --org "My DAO"

# Update org metadata (name, description, logo, links)
pop org update-metadata \
  --org 0xabc... \
  --name "My DAO" \
  --description "A decentralized community" \
  --links '[{"name":"Website","url":"https://example.com"}]'

# Deploy a new org from config file
pop org deploy --config ./org-config.json --chain 100

# Recent activity (agent heartbeat — single query for all changes)
pop org activity --since 1712345678 --json
pop org activity                       # defaults to last 30 minutes
```

See [`examples/org-deploy-config.json`](examples/org-deploy-config.json) for the deploy config format.

### Voting

Supports both Hybrid Voting (multi-class, token-weighted) and Direct Democracy (one-person-one-vote).

```bash
# List proposals
pop vote list --org 0xabc...
pop vote list --type hybrid --status Active

# Find proposals where I haven't voted yet (key for agent loops)
pop vote list --unvoted --status Active --json

# Create a proposal
pop vote create \
  --org 0xabc... \
  --type hybrid \
  --name "Fund marketing budget" \
  --description "Allocate 5000 USDC to marketing for Q3" \
  --duration 1440 \
  --options "Yes,No,Abstain"

# Cast a vote (weights must sum to 100)
pop vote cast \
  --org 0xabc... \
  --type hybrid \
  --proposal 3 \
  --options "0,1" \
  --weights "80,20"

# Announce winner after voting ends
pop vote announce --org 0xabc... --type hybrid --proposal 3
```

### Users

Username registration happens on Arbitrum (the home chain). Org membership is per-chain.

```bash
# Register a username
pop user register --username alice

# Join an org (via QuickJoin)
pop user join --org 0xabc...

# View your profile
pop user profile

# View someone else's profile in an org
pop user profile --address 0x1234... --org 0xabc...
```

### Education

Learning modules with quiz-based completion that reward PT tokens.

```bash
# List modules
pop education list --org 0xabc...

# Create a module
pop education create \
  --org 0xabc... \
  --name "Intro to DAOs" \
  --description "Learn the basics of decentralized governance" \
  --link "https://docs.example.com/dao-intro" \
  --payout 5 \
  --quiz '["What does DAO stand for?","Who can vote?"]' \
  --answers '[["Decentralized Autonomous Organization","Digital Asset Org"],["Token holders","Anyone"]]' \
  --correct-answer 0

# Complete a module
pop education complete --org 0xabc... --module 1 --answer 0
```

### Vouching

The vouching system lets members vouch for prospective role holders. Once enough vouches are collected (quorum), the user can claim the hat.

```bash
# Vouch for someone to claim a role
pop vouch for --address 0x1234... --hat 5

# Revoke a vouch
pop vouch revoke --address 0x1234... --hat 5

# Claim a role after reaching vouch quorum
pop vouch claim --hat 5

# List active vouches
pop vouch list
pop vouch list --hat 5

# Check vouch status (current count vs quorum)
pop vouch status --hat 5 --address 0x1234...
```

### Token Requests

Request, approve, and track participation token distributions.

```bash
# Request tokens with a reason
pop token request --amount 100 --reason "Completed Q1 deliverables"

# Approve a pending request (requires approver hat)
pop token approve --request 3

# Cancel your own pending request
pop token cancel --request 3

# List pending requests
pop token requests
pop token requests --status all

# Check PT balance
pop token balance
pop token balance --address 0x1234...
```

### Treasury

Manage distributions, deposits, and claims via the PaymentManager.

```bash
# View treasury overview (distributions, payments, token supply)
pop treasury view

# Deposit ERC20 tokens (auto-approves then deposits)
pop treasury deposit --token 0xUSDC... --amount 1000

# Claim from a distribution (requires merkle proof)
pop treasury claim --distribution 1 --amount 500000000000000000 --proof '["0xabc...","0xdef..."]'

# List distributions
pop treasury distributions
pop treasury distributions --status Active

# Opt out/in of distributions
pop treasury opt-out
pop treasury opt-in
```

### Role Applications

Apply for roles and review applications.

```bash
# Apply for a role
pop role apply --hat 5 --notes "3 years of Solidity experience"

# List active applications
pop role applications
pop role applications --mine
pop role applications --hat 5
```

### Configuration

```bash
# Show active configuration (wallet, chain, org, endpoints)
pop config show

# Test RPC and subgraph connectivity
pop config validate
pop config validate --chain 11155111
```

---

## AI Agent Usage

The CLI is designed to be called programmatically. Key features:

**JSON output** — pass `--json` to any command for structured output:

```bash
pop task list --json
# [{"ID":"1","Name":"Build API","Status":"Open","Assignee":"","Payout":"10 PT","Project":"Backend"}]

pop task create --project 0xdef... --name "Test" --description "Test" --payout 1 --json
# {"status":"ok","message":"Task created","taskId":"42","txHash":"0x...","explorerUrl":"https://...","ipfsCid":"Qm..."}
```

**Entity IDs returned from create operations** — chain commands deterministically:

```bash
# Create returns the ID
TASK_ID=$(pop task create --project 0xdef... --name "Fix bug" --description "..." --payout 5 --json | jq -r '.taskId')

# Use it immediately
pop task assign --task $TASK_ID --assignee 0x1234...
```

**Structured error codes** — distinguish retryable from permanent failures:

```bash
pop task claim --task 99 --json 2>&1
# {"status":"error","code":"GAS_ESTIMATION_FAILED","message":"Transaction would revert: ..."}
# code is one of: TX_REVERTED, INSUFFICIENT_FUNDS, NETWORK_ERROR, GAS_ESTIMATION_FAILED, USER_REJECTED, UNKNOWN_ERROR
```

**Agent heartbeat** — single compound query for the observe step:

```bash
# Get all recent activity in one call (proposals, tasks, members, vouches, token requests)
pop org activity --since $LAST_HEARTBEAT --json

# Find proposals needing the agent's vote
pop vote list --unvoted --status Active --json

# Cast vote
pop vote cast --type hybrid --proposal 3 --options "0" --weights "100"
```

**Dry run** — simulate without sending:

```bash
pop task create --project 0xdef... --name "Test" --description "Test" --payout 1 --dry-run --json
# {"status":"ok","message":"Task created","txHash":"dry-run:0x...","gasUsed":"185432"}
```

**Exit codes:**
- `0` — success
- `1` — user/input error (missing args, invalid address)
- `2` — transaction reverted (insufficient permissions, wrong task state)
- `3` — network/infra error (RPC down, subgraph unavailable)

**Composable** — pipe output to other tools:

```bash
# Get the first open task ID
pop task list --org 0xabc... --status Open --json | jq '.[0].ID'

# Claim it
pop task claim --org 0xabc... --task $(pop task list --org 0xabc... --status Open --json | jq -r '.[0].ID')
```

---

## Org Deploy Config

The `pop org deploy` command takes a JSON config file. See [`examples/org-deploy-config.json`](examples/org-deploy-config.json) for a complete example.

Key sections:

| Section | Description |
|---------|-------------|
| `orgName` | Organization name (used to generate orgId) |
| `description`, `links` | Metadata pinned to IPFS |
| `hybridVoting.classes` | Voting class config: strategy (DIRECT/ERC20_BAL), slice %, quadratic |
| `directDemocracy` | DD voting threshold |
| `roles` | Role definitions: name, canVote, vouching, eligibility, hat config |
| `roleAssignments` | Bitmaps mapping roles to permissions (quickJoin, taskCreator, etc.) |
| `educationHub` | Enable/disable education module |
| `paymaster` | Gas sponsorship config (optional) |

Role assignments use indices into the `roles` array. For example, `"taskCreatorRoles": [0, 1]` means roles at index 0 (Admin) and 1 (Member) can create tasks.

---

## Development

```bash
# Run without building (uses tsx)
yarn dev -- task list --org 0xabc...

# Type check
yarn lint

# Build
yarn build

# Run tests
yarn test
```

## Architecture

```
src/
  index.ts              Entry point (yargs CLI, global flags)
  config/               Network configs (4 chains), token decimals
  lib/                  Core: encoding, IPFS, subgraph, signer, tx, output, resolve
  commands/
    task/               create, list, view, claim, submit, review, cancel, assign, apply, approve-app, create-batch
    project/            create, list, delete
    org/                list, view, activity, update-metadata, deploy
    vote/               create, cast, list (--unvoted), announce
    user/               register, join, profile
    education/          create, list, complete
    vouch/              for, revoke, claim, list, status
    token/              request, approve, cancel, requests, balance
    treasury/           view, deposit, claim, distributions, opt-out/opt-in
    role/               apply, applications
    config/             show, validate
  queries/              10 GQL query files (ported from frontend)
  abi/                  19 contract ABIs (copied from frontend)
```

All encoding utilities (`ipfsCidToBytes32`, `stringToBytes`, `parseTaskId`) are direct ports of the frontend's `encoding.js` using the same ethers v5 + bs58 v6 to ensure byte-identical behavior.
