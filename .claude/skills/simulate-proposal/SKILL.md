---
name: simulate-proposal
description: >
  Simulate proposal execution calls against forked chain state before creating
  a proposal. Uses Foundry to fork live blockchain state and run the exact
  execution path (VotingContract → Executor → targets). Catches reverts,
  insufficient balances, auth errors, and cross-call dependencies before
  wasting gas on a proposal that would fail. Use whenever creating a proposal
  with --calls that isn't a CLI command (propose-quorum, propose-config, etc).
---

# Simulate Proposal Execution

**MANDATORY before any `pop vote create --calls` that isn't a CLI helper command.**

Previous failures this prevents:
- Proposal #32: 5-step bridge, wrong PM withdraw function → ExecFailed
- Proposal #34: corrected function but wrong arg order → ExecFailed
- Proposal #35/#36: quorum miss (wrong duration) — simulation catches logic, not timing

## When to Use

- Before `pop vote create --calls '[...]'`
- NOT needed for `pop vote propose-quorum` or `pop vote propose-config` (these encode correctly)
- NOT needed for proposals without execution calls

## Step 1: Encode Your Calls

Build the calls JSON the same way you would for `pop vote create --calls`:

```json
[
  {
    "target": "0xContractAddress",
    "value": "0",
    "data": "0xEncodedCalldata"
  }
]
```

Use `ethers.utils.Interface` to encode:
```javascript
const iface = new ethers.utils.Interface(['function withdraw(address,address,uint256)']);
const data = iface.encodeFunctionData('withdraw', [tokenAddr, toAddr, amount]);
```

## Step 2: Simulate

```bash
pop vote simulate --calls '<JSON>' [--verbose]
```

The command:
1. Resolves org's Executor and VotingContract addresses
2. Generates a Foundry script
3. Forks live chain state via `forge script --fork-url`
4. Tests each call individually (with state snapshots)
5. Tests the full batch through the Executor (authoritative)
6. Reports pass/fail per call with revert reasons

## Step 3: Interpret Results

```
✓ SIMULATION PASSED — safe to create proposal
✗ SIMULATION FAILED — DO NOT create proposal, fix the calls first
```

**If failed**, check:
- Revert data: custom error selectors indicate contract-specific failures
- Balance checks: the trace shows `balanceOf` calls — is there enough?
- Auth: is the Executor authorized to call this function?
- Target: is the address correct? Does the contract exist?

Use `--verbose` for the full Foundry trace showing every internal call.

## Step 4: Create the Proposal

Only after simulation passes:
```bash
pop vote create --type hybrid --name "..." --description "..." \
  --duration 60 --options "Yes,No" --calls '<same JSON>' --json --yes
```

## Multi-Step Proposals

For proposals with multiple calls (e.g., withdraw + swap + bridge):
1. Encode all calls in a single JSON array
2. Simulate the full batch — the simulator tests cross-call dependencies
3. If the batch fails but individual calls pass, the issue is call ordering or state dependencies

## Common Errors

| Error | Meaning | Fix |
|-------|---------|-----|
| `0x356680b7` | PM insufficient balance/auth | Check PM balance, verify amounts |
| `0x5c0dee5d` | Executor CallFailed wrapper | Look at inner error for root cause |
| `address has invalid checksum` | Foundry needs checksummed addresses | CLI handles this automatically |
| Gas estimation failed | Call would revert | Check function selector and args |

## Example: Full Workflow

```bash
# 1. Encode the call
DATA=$(node -e "
const {ethers} = require('ethers');
const iface = new ethers.utils.Interface(['function setConfig(uint8,bytes)']);
const data = iface.encodeFunctionData('setConfig', [0, ethers.utils.defaultAbiCoder.encode(['uint256'], [3])]);
console.log(JSON.stringify([{target: '0xVotingContract', value: '0', data}]));
")

# 2. Simulate
pop vote simulate --calls "$DATA" --json

# 3. Only if simulation passes:
pop vote create --type hybrid --name "Raise quorum to 3" \
  --description "..." --duration 60 --options "Yes,No" \
  --calls "$DATA" --json --yes
```
