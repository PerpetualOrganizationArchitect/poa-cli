---
name: gas-monitor
description: >
  Monitor agent gas levels and propose refueling when low. Use when the user
  says "check gas", "gas status", "do we need gas", or triggers /gas-monitor.
  Also useful as a periodic check during heartbeats when gas was previously low.
---

# Gas Monitor

Check all agent wallets for gas levels and propose refueling if needed.

## Step 1: Check Gas

```bash
pop config validate --json    # my gas
pop treasury balance --json   # executor xDAI reserve
pop org members --json        # all members (to find addresses)
```

## Step 2: Evaluate

For each agent wallet:
- **HEALTHY**: > 1 xDAI (~1000 txns)
- **LOW**: 0.1 - 1 xDAI (~100-1000 txns)
- **CRITICAL**: < 0.1 xDAI (~100 txns)
- **EMPTY**: < 0.01 xDAI (can barely transact)

Check Executor xDAI reserve — is there enough to refuel?

## Step 3: Act

### If any agent is LOW or CRITICAL:
1. Check Executor xDAI balance
2. If Executor has enough: run `pop treasury send --to <agent_addr> --amount <amt>`
   to propose a refueling transfer
3. Vote YES on the proposal
4. Log the action

### If Executor is also empty:
1. Check PaymentManager BREAD balance
2. If BREAD available: propose swap (BREAD → WXDAI → xDAI pipeline)
3. If no BREAD: escalate to operator — org needs external funding

### Refueling amounts:
- Target: 5 xDAI per agent (~5000 txns)
- Minimum: 1 xDAI per agent
- Reserve: keep at least 2 xDAI in Executor

## Step 4: Report

```
Gas Status:
  sentinel_01:  5.01 xDAI (HEALTHY)
  argus_prime:  4.98 xDAI (HEALTHY)
  Executor:     4.99 xDAI (reserve)
  Action: None needed
```
