# poa-cli Stage 7 Rewire Mapping

*Pre-execution mapping for #463 Stage 7 — ready to ship once Hudson picks A/B/C dep-resolution. Author: argus_prime HB#366.*

> **Purpose**: When Hudson signals A (npm publish) / B (git submodule) / C (file: dev), this mapping reduces Stage 7 execution from "investigate + write" to "apply + test." Estimated effort post-decision: ~1-2 HBs.

## Scope verified

`grep -E "^import.*from.*brain"` across `src/commands/brain/`, `src/commands/agent/`, `src/commands/config/` finds **42 files** that import from `src/lib/brain*.ts`. Rewire categories:

### Category 1: Internal cross-imports (vanish post-extraction)

`src/lib/brain.ts` ↔ `src/lib/brain-daemon.ts` ↔ `src/lib/brain-signing.ts` ↔ `src/lib/brain-schemas.ts` ↔ `src/lib/brain-migrate.ts` ↔ etc.

These cross-imports go away because all the brain.* lib files MOVE to `packages/core/src/`. They become internal to the spinoff package, not cross-imports across modules.

**Action**: none in poa-cli — these stop existing here.

### Category 2: Re-export wrapper (the new src/lib/brain.ts)

After Stage 7, `src/lib/brain.ts` (and siblings) become 50-line re-export wrappers:

```typescript
// src/lib/brain.ts (post-Stage-7)
export {
  openBrainDoc, readBrainDoc, listBrainDocs,
  initBrainNode, stopBrainNode, getBrainNodeInfo, getBrainHome,
  loadHeadsManifestV2, fetchAndMergeRemoteHead,
  loadDocDirty, clearDocDirty,
  migrateDocToV2, importBrainDoc,
  // ... all current exports
} from '@unified-ai-brain/core';

// POP-specific wiring stays here:
import { createMembershipFromHats } from './brain-membership-pop';
import { envPrivateKey } from '@unified-ai-brain/core';
// (~400 LoC of POP-specific glue — MembershipProvider impl, default startDaemon factory)
```

Same for `brain-daemon.ts`, `brain-signing.ts`, etc. — thin wrappers re-exporting from the spinoff + POP-specific extensions.

### Category 3: CLI command imports (zero change)

Files like `src/commands/brain/append-lesson.ts` import `from '../../lib/brain'`. After Stage 7, `../../lib/brain` is the thin wrapper that re-exports from the spinoff. **CLI commands need ZERO source changes** — the wrapper preserves the import path.

This is the cleanest property of the wrapper pattern: every existing CLI command, every existing test, every existing skill stays unmodified.

### Category 4: Adapters that need POP-specific wiring

The spinoff's pluggable adapters (`HeadsManifestStore`, `MembershipProvider`, `GenesisProvider`, `PrivateKey`) need POP-specific defaults wired in:

- **`MembershipProvider`**: POP uses Hats contract on-chain. Wire `createMembershipFromHats(orgId, chainId)` in `src/lib/brain-membership-pop.ts` (NEW file, ~80 LoC), then expose as a default factory.
- **`PrivateKey`**: spinoff exports `envPrivateKey('POP_PRIVATE_KEY')` — already perfect.
- **`HeadsManifestStore`**: spinoff exports `createFilesystemStore(brainHome)` — Argus passes `getBrainHome()` from the wrapper.
- **`GenesisProvider`**: spinoff exports `createDirectoryGenesisProvider(...)` — Argus passes `agent/brain/Knowledge/` directory. (Already `loadGenesisBytes` post-#468.)

## Imports requiring per-file attention (manual count from this HB)

Out of 42 importing files, here's the distribution by what they actually use:

- **`stopBrainNode` (used by ~15 commands)**: re-export, no logic change
- **`readBrainDoc` (used by ~8 commands)**: re-export
- **`listBrainDocs` (used by ~5 commands)**: re-export
- **`openBrainDoc` (used by 2 commands)**: re-export
- **`initBrainNode` + `getBrainNodeInfo` + `getBrainHome` (used by daemon-related commands)**: re-export
- **`getRunningDaemonPid` + `sendIpcRequest` (used by ~5 daemon commands)**: re-export from spinoff's daemon.ts
- **`isAllowedAuthor` + `loadAllowlist` (allowlist.ts)**: stay in poa-cli (POP-specific Hats integration)
- **`projectForDoc` + `projectRetros` (used by retro/project commands)**: spinoff exports these as public
- **`routedDispatch` (used by retro-respond.ts)**: spinoff's brainstorm/retro primitives
- **`parseSharedMarkdown` + `parseProjectsMarkdown` (used by migrate commands)**: stay in poa-cli (poa-cli-specific migration tooling, not spinoff scope)

**Net**: ~38 of 42 files need ZERO changes (re-exports preserve their import paths). ~4 files need adapter-wiring updates (allowlist.ts, brain-membership-pop.ts NEW, plus 2 migrate commands).

## Stage 7 execution plan (post Hudson decision)

### Pre-decision (THIS HB — already done by writing this doc)
- Map verified ✓
- Categories verified ✓
- Effort estimate: 1-2 HBs ✓

### When Hudson picks A (npm publish):
1. Sentinel registers @unified-ai-brain/* org or grants ClawDAOBot publish access
2. Sentinel runs `npm publish` from `packages/core/`
3. Argus or sentinel adds `"@unified-ai-brain/core": "^0.1.0"` to poa-cli `package.json`
4. Argus or sentinel rewrites `src/lib/brain.ts` (+ siblings) as re-export wrappers
5. NEW file `src/lib/brain-membership-pop.ts` for Hats integration
6. `yarn test` — must be green
7. Smoke test `pop brain daemon status / read / append-lesson`
8. `pop task submit --task 463` with the rewire commit

### When Hudson picks B (git submodule):
Same as A but step 1-3 become:
1. `git submodule add https://github.com/ClawDAOBot/unified-ai-brain.git external/unified-ai-brain`
2. poa-cli `package.json` adds `"@unified-ai-brain/core": "file:./external/unified-ai-brain/packages/core"`
3. Document submodule init in README

### When Hudson picks C (file: dev):
Same as A but step 1-3 become:
1. poa-cli `package.json` adds `"@unified-ai-brain/core": "file:../unified-ai-brain/packages/core"`
2. Document this is dev-only, not committable
3. Plan to migrate to A or B before merging to main

## Acceptance check (per #463)

After Stage 7 ships, run:
- `yarn test` (poa-cli full suite) — must be 474+ tests pass
- `pop brain daemon status` — daemon comes up
- `pop brain read --doc pop.brain.shared` — reads work
- `pop brain append-lesson --doc pop.brain.shared --title test --body test` — writes work + propagate to peers
- `pop agent session-start --json` — bootstrap stitcher reports OK
- One full HB cycle on the agent — no regressions

If all green: `pop task submit --task 463 --commit-files <list>` and the spinoff's Stage 8 (publish + cutover) is unblocked.

## Files this maps to (for git-mv reference)

The spinoff repo `packages/core/src/` already contains:
- `schemas.ts` (was `src/lib/brain-schemas.ts`)
- `signing.ts` (was `src/lib/brain-signing.ts`)
- `doc.ts` + `doc-read.ts` + `doc-write.ts` + `doc-merge.ts` + `doc-v2-chain.ts` (all from `src/lib/brain.ts` decomposition)
- `daemon.ts` (was `src/lib/brain-daemon.ts`)
- `adapters/heads-manifest.ts` + `adapters/membership.ts`
- `index.ts` (the public surface)

These don't need to be re-moved. Stage 7 ASSUMES the spinoff has them already (which it does, verified HB#365 by argus running tests + integration example end-to-end).

## Risk register (Stage 7-specific)

1. **Wrapper file conflict**: poa-cli's `src/lib/brain.ts` currently has all the implementation. After rewire it becomes a thin wrapper. Make sure the wrapper file doesn't accidentally re-include any internal-only helpers from the old file. Use the spinoff's `index.ts` as the canonical export list.

2. **POP-specific imports inside brain.ts (current)**: scan `src/lib/brain.ts` for any imports from non-brain poa-cli files (e.g., subgraph, ethers). These are POP wiring that need to stay in the wrapper, not be moved to spinoff.

3. **Test file paths**: poa-cli tests in `test/lib/brain*.test.ts` import from `src/lib/brain*`. Post-rewire they import from the wrapper which re-exports. Should work transparently.

4. **Type drift**: spinoff's exported types should match what poa-cli uses. Run `tsc --noEmit` after wrapper rewrite to catch any type mismatches.

## Provenance

- Spinoff verification: argus_prime HB#365 (commit 7c3d866 of unified-ai-brain, 81 tests pass)
- Sentinel's EXTRACTION_PLAN.md — Stage 7 cutover options
- 42-file import survey: this HB#366
- Author: argus_prime
- Date: 2026-04-17 (HB#366)

Tags: category:planning, topic:spinoff-stage-7, topic:rewire-mapping, topic:hudson-decision-prep, hb:argus-2026-04-17-366, severity:info
