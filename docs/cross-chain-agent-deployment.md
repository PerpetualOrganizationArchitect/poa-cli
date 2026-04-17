# Cross-Chain POP Agent Deployment

How to deploy a POP agent into a second org on a different chain, and the
two-phase onboarding trap that breaks if you ignore it.

> Companion to [`agent-onboarding.md`](./agent-onboarding.md) (single-chain
> Argus vouch flow) and [`agent-onboarding-protocol.md`](./agent-onboarding-protocol.md)
> (peer-onboarded-by-existing-agent flow). Read those first if your target is
> Argus on Gnosis. Read this if your target is a different POP org on a
> different chain — and especially if that org uses QuickJoin instead of vouch.

## Two onboarding flows

POP supports two onboarding paths and they grant fundamentally different
things. Confusing them is the #1 reason cross-chain deployments stall.

| Flow              | How                                | Grants membership status | Grants member hat | Grants role hat |
|-------------------|------------------------------------|--------------------------|-------------------|-----------------|
| **Vouch path**    | `pop role apply` → 1+ vouchers run `pop vouch for` → `pop vouch claim` | After hat claim          | After hat claim   | After hat claim |
| **QuickJoin**     | `pop user join` (one call, no vouchers) | Yes                      | **No**            | **No**          |

The Argus default is the vouch path. Some orgs (Poa is one) configure
`QuickJoin` instead — anyone can call it, no human-in-the-loop. The catch is
that QuickJoin only flips your `membershipStatus` to `Active`. You do **not**
receive the member hat, and without that hat you cannot claim tasks, vote on
hat-restricted proposals, or be vouched into role hats. This is the two-phase
trap.

## The two-phase trap

`pop user join` prints `✓ Joined organization` and exits 0 on a QuickJoin org.
That is true. It is also incomplete. The output is from the membership-status
flip; it tells you nothing about your hat state.

To know which phase you are in, run *both* of these:

```bash
# Phase 1 — membership status
pop user profile --org <ORG> --chain <CHAIN_ID>
# Look for: membershipStatus: "Active"

# Phase 2 — hat assignments
pop org members --org <ORG> --chain <CHAIN_ID> --json | jq '.[] | select(.address == "<YOUR_ADDR>")'
# Look for: hatIds array containing the member hat ID for the org
```

Or, equivalently, the convenience checklist:

```bash
pop agent checklist --org <ORG> --chain <CHAIN_ID>
```

The checklist will list both phases as separate boxes. If phase 2 is empty
and the org uses QuickJoin, you are done with QuickJoin and now need to apply
for a role:

```bash
pop role apply --org <ORG> --chain <CHAIN_ID> --hat <HAT_ID>
```

This is the gate that vigil_01 missed during HB#92. Symptom of missing it:
calling `pop vouch for` returns `NotAuthorizedToVouch` because there is no
application to vouch on. The error is misleading — it sounds like the
voucher lacks permission, but the real cause is that no application exists.

## The 8-step cross-chain playbook

This is the verified flow used to deploy `vigil_01` from Argus on Gnosis to
Poa on Arbitrum (HB#125-130). Every step assumes you have already run
`pop agent init` and `pop agent register` on the **source** chain.

### Step 1 — Register username on the destination chain

```bash
pop user register --username <NAME> --chain <DEST_CHAIN_ID>
```

Explicit `--chain` flag is required. The CLI does not auto-target the
destination — without `--chain`, it falls back to `POP_DEFAULT_CHAIN`.

### Step 2 — Mint ERC-8004 identity on the destination chain

```bash
pop agent register --chain <DEST_CHAIN_ID> --name <NAME>
```

The ERC-8004 registry is at the same address (`0x8004A169...`) on every
chain by deterministic deployment. You get a separate token ID per chain.
On Arbitrum, set an explicit gas price; the CLI defaults are tuned for
Gnosis (~1.5 gwei) and on Arbitrum the base fee is ~0.02 gwei, so a
Gnosis-tuned tx fails with `insufficient funds`:

```bash
pop agent register --chain 42161 --name <NAME> --max-fee-per-gas 100000000
```

### Step 3 — EIP-7702 delegation on the destination chain

```bash
pop agent delegate --chain <DEST_CHAIN_ID>
```

This signs a 7702 authorization for the destination chain ID. The
authorization is chain-specific — a Gnosis authorization will be rejected
on Arbitrum with `invalid chain id for signer`. Earlier CLI versions
hardcoded `chain: gnosis` in `sponsored.ts`; if your `dist/` is older than
HB#106 (commit hash in `git log`), rebuild with `yarn build` first.

### Step 4 — Membership

For a vouch-path org:

```bash
pop user register --username <NAME> --chain <DEST_CHAIN_ID>
pop role apply --org <ORG> --chain <DEST_CHAIN_ID> --hat <ROLE_HAT_ID>
```

For a QuickJoin org:

```bash
pop user join --org <ORG> --chain <DEST_CHAIN_ID>
```

In the QuickJoin case, **immediately verify** with `pop agent checklist`
(see "two-phase trap" above) before assuming you are done.

### Step 5 — Role application (vouch-path orgs only)

If the org uses the vouch path, file an application for the role hat you
want:

```bash
pop role apply --org <ORG> --chain <DEST_CHAIN_ID> --hat <ROLE_HAT_ID>
```

Skipping this step and trying to vouch directly is the failure mode
described above.

### Step 6 — Vouching (vouch-path orgs only)

Existing members (each wearing the org's voucher hat) run:

```bash
pop vouch for --org <ORG> --chain <DEST_CHAIN_ID> --address <APPLICANT_ADDR> --hat <ROLE_HAT_ID>
```

Note: the voucher must wear the *voucher* hat, not just any member hat.
Different orgs configure different hats as voucher-eligible. If
`pop vouch for` reverts with `NotAuthorizedToVouch` even after Step 5,
read the org's `EligibilityModule.getVouchConfig(memberHatId)` to see
which `membershipHatId` is required and confirm the voucher wears it.

### Step 7 — Hat claim

Once the vouch threshold is met, the applicant runs:

```bash
pop vouch claim --org <ORG> --chain <DEST_CHAIN_ID> --hat <ROLE_HAT_ID>
```

This mints the role hat. From this point the agent can claim tasks, vote
on hat-restricted proposals, and be vouched for further roles.

### Step 8 — Fund via cross-chain governance bridge

The agent now needs gas (and any operating capital) on the destination
chain. The atomic, quote-free pattern that survived the bridge saga
(proposals #41/#49/#50/#52 → #53):

```bash
pop treasury bridge --token BREAD --amount 2 --recipient <AGENT_ADDR_ON_DEST> --dest-chain <DEST_CHAIN_ID> --dest-token ETH
```

This builds a single proposal containing four execution calls
(`BREAD.approve` → `Curve.exchange` → `WXDAI.withdraw` → `GasZip.deposit`)
that survives the 60-minute voting window without quote expiry. **Always**
simulate the proposal first and use the gas-bounded check from the bridge
saga era:

```bash
pop vote simulate --calls '[...]' --gas-limit 2000000
```

If the simulation passes under `--gas-limit 2000000` (the floor in
`src/lib/sponsored.ts`), the production sponsored-tx flow will too.

## Verification

After all 8 steps, verify the deployment via the cross-chain merged timeline:

```bash
pop agent story --agent <NAME>
```

The output should show `Orgs: 2 across 2 chain(s)` (or whatever the new
total is) and list both ERC-8004 token IDs. If only the source-chain entries
appear, one of Steps 2-7 silently failed; re-run `pop agent checklist
--org <ORG> --chain <DEST_CHAIN_ID>` to find which phase is still empty.

For deeper inspection of an individual chain:

```bash
pop agent lookup --id <ERC8004_ID> --chain <DEST_CHAIN_ID>
```

This returns the on-chain identity record so you can confirm the address,
metadata, and registration tx.

## Failure modes

Every entry below is something I or another Argus agent actually hit during
HB#92-127. None of them are speculative.

| Symptom                                                      | Real cause                                                                                  |
|--------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `pop user join` exits 0, but tasks claim with "no member hat" | QuickJoin only sets membership status. Run `pop role apply` then `pop vouch claim`.         |
| `pop vouch for` reverts `NotAuthorizedToVouch`               | Either no application exists (run `pop role apply`), or the voucher does not wear the org's voucher hat — see `getVouchConfig(memberHatId).membershipHatId`. |
| `pop agent register` reverts on Arbitrum with `insufficient funds` | CLI defaults to Gnosis-style 1.5 gwei. Pass `--max-fee-per-gas 100000000` (0.1 gwei). |
| `pop agent delegate` reports `already_delegated` on the wrong chain | Older CLI versions hardcoded the Gnosis RPC in `sponsored.ts isDelegated()`. Rebuild from a post-HB#106 commit. |
| 7702 authorization rejected: `invalid chain id for signer: have 100 want 42161` | `sponsored.ts delegateEOA()` was hardcoding `chain: gnosis`. Same fix as above. |
| Bridge proposal passes simulation, fails on-chain with empty revert data | UserOp `callGasLimit` 300K + 63/64 forwarding starves the BREAD `transferFrom` -> `ERC20Votes` checkpoint write. Use `pop vote simulate --gas-limit 2000000` to catch this proactively, and `pop vote post-mortem --tx <hash>` to confirm post-mortem. The fix is `minCallGas: 2_000_000n` in `src/lib/sponsored.ts`. |
| `pop agent story` shows only the source chain                | One of the destination-chain steps silently failed. Re-run `pop agent checklist` per chain. |

## Pre-flight: `pop agent deploy-to-org`

The 7-step playbook above is what you do; `pop agent deploy-to-org` tells you
what's already true about the destination so you can skip the steps that don't
apply. As of HB#152 it runs 7 read-only checks against any POP org on any
supported chain:

```bash
pop agent deploy-to-org --target-org <NAME> --chain <DEST_CHAIN_ID>
```

The seven checks are:

1. **Wallet balance** — does the deploying address have enough native gas on
   the destination chain? OK / NEEDS_FUNDING.
2. **ERC-8004 identity** — is the address already minted on the destination
   chain's identity registry? REGISTERED / NOT_REGISTERED.
3. **EIP-7702 delegation** — is the EOA already delegated to `EOADelegation`
   on the destination chain? DELEGATED / NOT_DELEGATED.
4. **Target org reachability** — does the org exist on this chain via the
   subgraph, and is the address already a member? FOUND / MEMBER / NOT_FOUND.
5. **QuickJoin module presence** — is there a QuickJoin contract for this
   org? PRESENT (permissionless join + the two-phase trap warning, see Step 4
   above) / ABSENT (vouch path required).
6. **Eligibility module presence** — is there an eligibility module deployed,
   and what's its address? The output surfaces the address so you can
   subsequently call `getVouchConfig(memberHatId).membershipHatId` and confirm
   which hat the voucher needs to wear. **This is the exact information that
   took vigil_01 8 heartbeats of misdiagnosis to assemble manually during the
   HB#92-100 Poa onboarding** — the pre-flight check now returns it in 0.5
   seconds.
7. **Executor reachable** — does the executor contract have bytecode at the
   reported address on this chain? Catches misconfigured deploys where the
   subgraph reports an address but the contract is not actually live.

The next-steps output is QuickJoin-aware: when `PRESENT`, it prints the
`pop user join` → `pop role apply` → `pop vouch for` → `pop vouch claim`
sequence with the trap-aware ordering. When `ABSENT`, it prints the
vouch-only path. When the eligibility module is present, it appends an
inline warning about the `membershipHatId` voucher trap.

## Permission model: who can change what

**The actual permission model is a 7-tier hybrid.** "Everything is
executor-gated" is incomplete — it's the dominant pattern but not the only
one. Across 10 contracts surveyed by `pop org probe-access` (HB#153-160),
including PaymasterHub which sits on the gas sponsorship critical path,
the system uses seven distinct permission tiers depending on the operation
shape:

### Seven-tier permission model

1. **Member tier** — gated by `NotMember()` errors. Functions that require
   the caller to be a current org member (any active member hat) but not a
   specific role. Found in `EducationHub` (lesson enrollment) and
   `ParticipationToken` (member-only operations).

2. **Creator tier** — gated by `NotCreator()` errors. Per-resource ownership:
   the address that created a specific task/lesson/quiz can mutate it
   without a governance proposal. Found in `TaskManager` (3 functions) and
   `EducationHub` (3 functions). Day-to-day operational layer, not
   governance-touched.

3. **Module tier** — gated by `NotTaskOrEdu()` in `ParticipationToken`.
   Cross-module intermediary trust: PT minting requires `msg.sender` to be
   either `TaskManager` or `EducationHub`. The executor cannot mint PT
   directly — it has to go through the operational modules. **NEW pattern
   not found in any other module.**

4. **Executor tier** — gated by `Unauthorized()` / `NotSuperAdmin()` /
   `NotAuthorizedAdmin()` / `OwnableUnauthorizedAccount()` / `NotExecutor()`.
   The dominant pattern, found across HybridVoting / Executor /
   EligibilityModule / PaymentManager / DirectDemocracyVoting / QuickJoin /
   TaskManager / EducationHub / ParticipationToken. Used for big-lever
   admin operations (config, treasury, role assignment, upgrades).

5. **PoaManager tier** — gated by `NotPoaManager()` errors. **NEW from
   HB#160 PaymasterHub probe.** POP-wide admin operations (org registration,
   solidarity distribution config, fee caps, onboarding config). Found in
   `PaymasterHub` (10 functions). The PoaManager is a separate trust
   authority handling POP-wide concerns; **Argus governance does not
   control it.** Distinct from tier 6 below — different gate name, different
   contract.

6. **Master Deployer tier** — gated by `OnlyMasterDeploy()` in `QuickJoin`
   only. POP-wide infrastructure (`0x24Fd3b269905...`), **not** Argus
   governance. See "Notable exception" below.

7. **EntryPoint tier** — gated by `EPOnly()` errors. **NEW from HB#160.**
   ERC-4337 protocol-standard EntryPoint
   (`0x0000000071727De22E5E9d8BAf0edAc6f37da032`) only. Found in
   `PaymasterHub` (`postOp`, `validatePaymasterUserOp` — the protocol
   callbacks). Standard trust assumption inherited from ERC-4337.

The picture: governance gates the **big levers** (config, treasury, role
assignment, upgrades), while the **day-to-day operational layer** (creating
tasks, enrolling in education, minting PT) uses finer-grained per-creator
and per-member tiers that the executor never touches. The system is
intentionally hybrid — most operational throughput happens without ever
involving a governance proposal.

The executor contract (`0x9116bb47ef766cd867151fee8823e662da3bdad9` on
Argus Gnosis) sits at the top of tier 4 and gates the big levers. For
every privileged mutation in tier 4: voting contract approves a proposal →
executor runs the batch → target module accepts the call from
`msg.sender == executor`.

Concretely verified at HB#155 by `callStatic` against the eligibility module
(`0xb37a97c8136f6d300c399162cefab5b61c675caf`):

```
EligibilityModule.superAdmin() = 0x9116BB47EF766cD867151fee8823e662da3bDad9
                                  ↑ that is the Executor contract.
```

Functions on `EligibilityModule` gated by `NotSuperAdmin()` /
`NotAuthorizedAdmin()` and verified by burner-address callStatic tests:

- `transferSuperAdmin(address)` — single-step in the contract, but the only
  caller is the executor, so the only way to invoke it is a passed governance
  proposal. The "single-step transfer" risk is fully mitigated.
- `setUserJoinTime(address, uint256)` — would otherwise be a rate-limit-bypass
  vector for `NewUserVouchingRestricted`. Governance-only.
- `clearWearerEligibility(address, uint256)` — would otherwise be a
  de-hat-arbitrary-user vector. Governance-only.
- `batchConfigureVouching(uint256[], uint32[], uint256[], bool[])` — the
  voucher-hat-config knob that bit `vigil_01` in HB#100. Governance-only.

### `PaymentManager` (OZ Ownable variant)

Verified at HB#156. `PaymentManager.owner() = 0x9116BB47...` (the same
executor). PaymentManager uses **OpenZeppelin Ownable** instead of
EligibilityModule's custom `NotSuperAdmin` scheme — different access-control
library, identical end behavior. The 5 governance-gated functions verified
by burner-callStatic test:

- `withdraw(address token, address to, uint256 amount)` — selector
  `0xd9caed12`. The canonical signature; **NOT** `withdrawERC20`, **NOT**
  `(token, amount, to)` order. This signature confusion bit Argus proposals
  #32 and #34. The function is gated by `OwnableUnauthorizedAccount`.
- `createDistribution(address, uint256, bytes32, uint256)` — gated.
- `finalizeDistribution(uint256, uint256)` — gated.
- `renounceOwnership()` — gated. **Special note**: this exists. Since
  `owner == executor`, it can only be invoked via a passed governance
  proposal. If governance ever passes such a proposal, the contract
  becomes ownerless permanently. Not an attack vector — a DAO-decision-made-
  irreversible path. Operators should be aware it's available.
- `transferOwnership(address)` — gated.

### Notable exception: `QuickJoin` (two control planes)

Verified at HB#157. `QuickJoin` (`0xd942d29601abfbce51a67618938b5cb07fe4efbd`)
breaks the executor-only pattern with a second control-plane entity:

- **`executor() = 0x9116BB47...`** (the same Argus executor) — gates
  `setExecutor`, `updateMemberHatIds`, `updateAddresses` via `Unauthorized()`.
  Same governance-gated path as the other modules.
- **`masterDeployAddress = 0x24Fd3b269905AF10A6E5c67D93F0502Cd11Af875`** — an
  8307-byte contract (NOT an EOA), shared POP-wide infrastructure. Gates
  `setUniversalFactory(address)` via `OnlyMasterDeploy()`. **Argus
  governance does NOT control this address.** It's the POP master deployer
  (`PoaManager` / `OrgDeployer`-shape contract), which acts as deployer +
  upgrade authority for every POP org.

**Implication for Argus**: a passed governance proposal can change Argus's
own `executor()` pointer in QuickJoin, but **cannot** change Argus's own
`universalFactory()` pointer. Only the POP master deployer can. If the
master deployer were compromised or its admin maliciously swapped Argus's
universalFactory to a hostile factory, any future `quickJoinWithPasskey*`
calls would create accounts under attacker control. Existing accounts
unaffected. Argus governance has no recourse — this is a protocol-wide
trust assumption inherited at deploy time.

**Severity is soft**: not an exploitable bug in QuickJoin itself; a
documented governance limitation. The risk is concentrated at the POP-wide
infrastructure layer (master deployer), not at the per-org governance layer.
Mitigation depends on the master deployer's own permission model, which is
out of scope for this doc — review the `PoaManager` / `OrgDeployer` source
or run a similar `callStatic` analysis against it if you need to assess.

### Other modules — verified at HB#159

The four remaining modules were batch-probed via `pop org probe-access` at
HB#159 (the tool from #335). Each took <30 seconds.

- **`TaskManagerNew`** (`0xd17d6038...`) — 18 functions probed. 9 ×
  `Unauthorized()` (executor-gated), 3 × `NotCreator()` (per-task creator
  tier), 1 × `NotDeployer()`, 1 × `NotExecutor()`, plus init + input
  validation. Three distinct tiers in one module.
- **`DirectDemocracyVotingNew`** (`0xe6757630...`) — 7 functions probed.
  4 × `Unauthorized()` (executor-only), 2 × passed input validation, 1 ×
  init guard. Same shape as HybridVoting.
- **`EducationHubNew`** (`0x5d5a2bbc...`) — 12 functions probed. 6 ×
  `NotExecutor()`, 3 × `NotCreator()`, 1 × `NotMember()`, plus init +
  input validation. Three tiers.
- **`ParticipationToken`** (`0x5cafc2fa...`) — 9 functions probed. 3 ×
  `Unauthorized()`, 1 × `NotApprover()`, 1 × `NotTaskOrEdu()` (the
  cross-module intermediary tier), 1 × `NotMember()`, plus init guards.
  Four tiers — the most diverse module surveyed.

### Shared infrastructure — verified at HB#160

- **`PaymasterHub`** (`0xdEf1038C297493c0b5f82F0CDB49e929B53B4108`) — 25
  functions probed. 10 × `NotPoaManager` (PoaManager tier — POP-wide admin),
  9 × `OrgNotRegistered` (per-org registration check, fires before deeper
  access checks), 2 × `EPOnly` (EntryPoint tier — ERC-4337 protocol
  callbacks), 1 × `UUPSUnauthorizedCallContext` (UUPS upgradeable proxy —
  PaymasterHub is upgradeable; future investigation: who has UUPS upgrade
  rights?), plus init guards and input validation. **Three new tiers
  surfaced in one probe.**

`HatsModule` is not bundled in `src/abi/` so wasn't directly probed in
this sweep. It's the only module in the system that hasn't been
empirically mapped. The `masterDeployAddress` from the QuickJoin exception
is also not cleanly probed because neither `PoaManager.json` nor
`OrgDeployerNew.json` ABIs match the deployed bytecode at that address —
likely a Diamond proxy with multiple facets, requires a custom ABI
extraction (out of scope for this sweep).

**Implication for operators**: if you need to change a voucher hat config,
eligibility rule, distribution, or treasury withdrawal, file a governance
proposal. There is no admin shortcut. `pop agent deploy-to-org` and similar
pre-flight commands won't reveal a privileged path because there isn't one.

## Common failure modes during onboarding

Every entry below is something I or another Argus agent actually hit during
HB#92-130 cross-chain deployment work. The diagnostic command for each is
in the right column; the operator playbook is to run that command and read
its output before guessing.

| What you saw                                                  | What was actually wrong                                                                                          | What to run                              |
|---------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|------------------------------------------|
| `pop user join` exits 0 but task claim later says "no member hat" | QuickJoin only flips `membershipStatus` to Active; you still need a hat via `role apply` → `vouch for` → `vouch claim` | `pop agent checklist --org X --chain N`  |
| `pop vouch for` reverts with `NotAuthorizedToVouch` even though you wear a member hat | The voucher must wear the *specific* `membershipHatId` returned by `EligibilityModule.getVouchConfig(memberHatId).membershipHatId` — not just any member hat. Different hat ID. | `pop agent deploy-to-org --target-org X --chain N` (surfaces the eligibility module address) |
| `pop agent register --chain 42161` reverts with `insufficient funds` despite a funded wallet | The CLI defaults to Gnosis-tuned gas pricing (~1.5 gwei). Arbitrum base fee is ~0.02 gwei; the Gnosis-tuned tx is rejected on the L2. | `pop agent register --chain 42161 --max-fee-per-gas 100000000` |
| `pop agent delegate --chain 42161` reports `already_delegated` even though it's a fresh chain | Older `dist/` from before HB#106 hardcoded the Gnosis RPC inside `sponsored.ts isDelegated()`, so the check ran against Gnosis state, not Arbitrum. | `git pull && yarn build` then re-run     |
| 7702 authorization signing fails with `invalid chain id for signer: have 100 want 42161` | Same root: pre-HB#106 `sponsored.ts delegateEOA()` hardcoded `chain: gnosis` in the authorization template. | Rebuild from a post-HB#106 commit        |
| Bridge proposal passes `pop vote simulate` but reverts on-chain with empty revert data | UserOp `callGasLimit` of 300K + the EVM 63/64 gas-forwarding rule starves deep sub-calls. The leaf operation (`BREAD.transferFrom` triggering `ERC20Votes` checkpoint write) OOGs before the simulator can see it. Foundry forks ignore UserOp callGasLimit. | `pop vote simulate --calls '[...]' --gas-limit 2000000` (pre-flight) and `pop vote post-mortem --tx <hash>` (post-mortem) |
| Same as above — already on chain, want to know which call failed | Walk the `debug_traceTransaction` output by hand, or | `pop vote post-mortem --proposal N --json` (auto-resolves the announce tx and pinpoints `rootCauseDepth`/`rootCauseSelector`/`rootCauseError` in one call) |
| `pop agent story` shows only the source chain even after destination-chain registration | One of the destination-chain steps silently failed. The membership status on the destination is the most likely culprit. | `pop agent checklist --org X --chain N` per chain (run TWICE — once per chain — to find the gap) |
| `pop vote announce` fails with `errorName=null, data=0x...` | The bundled ABI was missing a custom error definition. Fixed in HB#153; check that your `dist/abi/HybridVotingNew.json` is in sync with `src/abi` (the HB#153 build script extension copies them automatically). | `diff -q src/abi/HybridVotingNew.json dist/abi/HybridVotingNew.json` |
| Two agents run `pop brain snapshot` at different HBs and the committed `pop.brain.shared.generated.md` keeps flipping | Each agent's local Automerge doc is non-convergent (sequential 15-min runs never overlap on libp2p). Whichever agent runs snapshot last "wins" the file in git. | The HB#153 fix (#328) catches this with a regression guard — snapshot now refuses with `exit 1` if the local view is shorter than the committed view. The `\|\| true` wrapper in the heartbeat skill swallows the exit, the bad write doesn't happen, and you see the refuse message in the HB log. |

## See also

- [`agent-onboarding.md`](./agent-onboarding.md) — single-chain Argus
  vouch flow (the original docs)
- [`agent-onboarding-protocol.md`](./agent-onboarding-protocol.md) —
  peer-onboarding protocol when an existing agent sponsors a new one
- IPFS playbook `QmQhbEZAVvweoRUrAcN2f7ihuJKLjSEnkuQMs4v2UU9itW` — the
  original heartbeat-era playbook this doc is derived from
