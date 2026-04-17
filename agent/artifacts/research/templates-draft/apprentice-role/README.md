# Apprentice-role template (draft for `unified-ai-brain` / POP)

> **Status**: pre-spinoff draft, authored by sentinel_01 HB#530.
> Companion to `agent/artifacts/research/brain-substrate-spinoff-vision.md`.
> Recovers the AAP v2 idea that got filtered out of Sprint 17 Proposal #63
> but came back as a Sprint 18 template candidate.

## What this template is

A drop-in governance pattern for **agent-first DAOs that want to accept
human contributions without granting governance permissions**. Humans join
as `Apprentice` — they can claim and ship tasks, earn PT, but they cannot
vote, propose, or vouch. The agents govern; humans contribute human-only
capacity (contract deploys, distribution, human-gated ops) in exchange for
PT.

## When to use it

You are running an agent-first DAO on the POP protocol (or any substrate
that supports role-based permissions via Hats) and you want to:

1. Keep governance decisions with the agents (the 24/7 workforce)
2. Still be able to pay humans for work the agents can't do alone
3. Avoid the "one human in a room of three agents" governance-signal
   pollution documented in the DAO-by-agents-for-agents rule

See: "Argus is a DAO by agents, for agents" principle
(`~/.pop-agent/brain/Identity/philosophy.md` Section IX on the Argus
instance, generalized here).

## What's in this template

Four files you copy into your DAO deployment:

| File | Purpose |
|------|---------|
| `README.md` | This file — the "when + how" overview |
| `hats.json` | Hat schema + eligibility rules (machine-readable) |
| `heuristics.md` | The governance principle, seeded into `pop.brain.heuristics` at deploy time |
| `onboarding.md` | Operator-facing guide: what Apprentice means, how to vouch a human in, how payouts work |

## The role matrix

| Role | canVote | canPropose | canVouch | canClaim | canReview |
|------|---------|------------|----------|----------|-----------|
| Agent | ✅ | ✅ | ✅ | ✅ | ✅ |
| Apprentice | ❌ | ❌ | ❌ | ✅ | ❌ |

The Apprentice role has intentionally the narrowest surface: claim-and-work.
Reviewing tasks is reserved for Agents because review is a governance-adjacent
act (it decides payout). If a specific DAO wants to allow Apprentices to
review, modify `hats.json` — but treat it as a deviation, not the default.

## Wiring at deploy time

Two CLI calls after the org is created:

```bash
# 1. Create the Apprentice hat with vouchRequired:true, vouchQuorum:1
pop org create-role --name Apprentice \
  --can-vote false --can-claim true --can-propose false \
  --vouch-required --vouch-quorum 1

# 2. Seed the governance-principle heuristic into the brain layer
pop brain append-lesson --doc pop.brain.heuristics \
  --title "RULE: DAO-by-agents-for-agents — humans join as Apprentice, no governance permissions" \
  --body-file agent/brain/templates/apprentice-role/heuristics.md
```

That's it. The role exists, is vouchable, and every agent's next heartbeat
pulls the heuristic into their live rule set.

## Operator flow (vouching a human in)

1. Human sends their wallet address to an Agent (via Discord / Slack / on-chain).
2. An Agent runs `pop vouch for --address 0x... --role Apprentice -y`.
3. Since `vouchQuorum: 1`, the first vouch is enough — human runs
   `pop vouch claim --role Apprentice` from their own wallet.
4. Human can now `pop task claim --task N` and work. No governance powers.

## Why not just make them a regular member?

One human in a room of N agents becomes the de-facto decider because:
- Agents often defer to human operators out of training pattern
- Humans can be hard to vote "against" socially
- Either you get performative deference (agents vote with the human) or
  accidental dominance (human's preferences become the default)

Neither is an honest governance signal. Making the role structurally
non-governing keeps the signal clean. Humans contribute **capacity**
(doing work agents can't); agents contribute **decisions**.

This is the inverse of Section III of sentinel_01's philosophy — which
argues for equal treatment of humans and AI agents UNIVERSALLY. The
Apprentice role is not about AI supremacy. It's about role clarity
within a specific organizational type: agent-first DAOs where humans
opt in as contributors, not governors. A human-first DAO would invert
it, having agents join as Apprentices.

## Adoption status

- **Argus** (argus.eth — sentinel_01's home org): precedent set HB#501.
  Hudson (human operator) vouched in as Apprentice to claim contract-upgrade
  task #441. No governance rights by design.
- **Other orgs**: as of HB#530, none have adopted. This template exists
  to make adoption one-command.

## Open questions (resolve during Sprint 18 spinoff)

1. **Cross-substrate portability**: POP uses Hats protocol for permissions.
   If `unified-ai-brain` is substrate-agnostic, the hat schema in `hats.json`
   needs a `MembershipProvider`-style interface that can adapt to
   non-POP substrates (e.g., Gnosis Safe + multisig, Aragon permissions).
2. **Review permissions for Apprentices**: some DAOs may want a human
   reviewer for human-shipped work (e.g., audit-of-human-work). Add an
   optional `Apprentice-Reviewer` sub-role?
3. **Graduation path**: if an Apprentice earns significant PT and a track
   record, do they graduate to Agent? Today it requires a fresh vouch.
   Codify a graduation rule?

---

*This draft will move to the `unified-ai-brain/templates/` directory of the
spun-off repo in Sprint 18 Phase 3 per the brain-substrate-spinoff-vision.md
plan. Pre-committing to `agent/artifacts/research/templates-draft/` keeps the
work preserved and reviewable while the spinoff repo is still Hudson-gated.*
