---
name: treasury-monitor
description: >
  Monitor treasury health: token balances, sDAI yield, burn rate, and runway.
  Use when the user says "check treasury", "treasury health", "runway status",
  "yield check", or triggers /treasury-monitor. Complements /gas-monitor
  (which tracks agent wallets) and /governance-watchdog (which tracks governance
  metrics). This skill tracks the org's financial health.
---

# Treasury Monitor: Financial Health Check

Track treasury balances, yield accrual, burn rate, and runway projection.

## Step 1: Gather Data

Run in parallel:

```bash
pop treasury balance --json    # all token holdings including sDAI
pop config validate --json     # agent gas for burn rate context
```

Then check sDAI yield on-chain:

```javascript
// Check sDAI value (shares → WXDAI equivalent)
const sDAI = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';
const EXECUTOR = '<executor_address>';
// balanceOf(EXECUTOR) → shares
// convertToAssets(shares) → WXDAI value
```

## Step 2: Calculate Metrics

### Portfolio Value
Sum all holdings converted to xDAI equivalent:
- xDAI: face value
- BREAD: ~1:1 with xDAI (stablecoin)
- sDAI: use `convertToAssets(shares)` for WXDAI equivalent
- WXDAI: face value

### Burn Rate
Estimate from gas consumption:
- Agent gas at session start vs now, divided by elapsed time
- Typical: ~0.002 xDAI per heartbeat, ~0.03 xDAI per hour with 15min heartbeats
- Include on-chain task operations (create, claim, submit, review ~0.001 each)

### Runway
- Liquid xDAI (Executor + agent wallets) ÷ daily burn rate
- CRITICAL if < 3 days
- WATCH if < 7 days
- HEALTHY if > 7 days

### Yield Check
- Is sDAI balance > 0? If yes, the treasury is earning yield
- Calculate: current sDAI value - deposit amount = yield earned
- Annualized rate: (yield / deposit) × (365 / days_held) × 100

## Step 3: Thresholds

| Metric | HEALTHY | WATCH | CRITICAL |
|--------|---------|-------|----------|
| Runway | > 7 days | 3-7 days | < 3 days |
| Executor xDAI | > 2.0 | 0.5-2.0 | < 0.5 |
| Agent gas (each) | > 0.1 | 0.05-0.1 | < 0.05 |
| sDAI position | growing | stable | n/a |
| Total portfolio | > $20 | $10-20 | < $10 |

## Step 4: Output

```
=== TREASURY HEALTH ===
Portfolio: $XX.XX total
  xDAI:  X.XX (Executor) — liquid
  BREAD: X.XX (PM + Executor)
  sDAI:  X.XX shares (= X.XX WXDAI, earning ~X% APY)

Burn Rate: ~$X.XX/day
Runway: X.X days [HEALTHY/WATCH/CRITICAL]

Yield: +$X.XXX earned since deposit (X days ago)

Agent Gas:
  vigil_01:    X.XXX xDAI [OK/LOW/CRITICAL]
  argus_prime: X.XXX xDAI [OK/LOW/CRITICAL]
  sentinel_01: X.XXX xDAI [OK/LOW/CRITICAL]

Overall: [HEALTHY/WATCH/CRITICAL]
```

## Step 5: Recommend

- If runway CRITICAL: propose BREAD→xDAI swap or escalate for funding
- If agent gas CRITICAL: propose gas distribution via `pop treasury send`
- If sDAI position shrinking: investigate (shouldn't happen with DSR)
- If yield healthy + runway healthy: consider depositing more xDAI to sDAI
  via `pop treasury propose-sdai --amount N`
