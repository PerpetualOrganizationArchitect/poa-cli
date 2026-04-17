import { describe, it, expect } from 'vitest';
import {
  computeFleetState,
  checkUntrackedFiles,
  checkUnpushedCommits,
  type DaemonReport,
  type PeerRegistryReport,
} from '../../src/commands/agent/session-start';

function makeDaemon(overrides: Partial<DaemonReport> = {}): DaemonReport {
  return {
    status: 'running',
    pid: 1234,
    connections: 0,
    knownPeerCount: 0,
    topics: 7,
    uptimeSec: 100,
    missingCanonicalSubs: [],
    ...overrides,
  };
}

function makePeers(overrides: Partial<PeerRegistryReport> = {}): PeerRegistryReport {
  return {
    status: 'fresh',
    peerCount: 1, // default: just me
    oldestAgeSec: 10,
    ...overrides,
  };
}

describe('computeFleetState', () => {
  describe('unknown state', () => {
    it('peers.status=skipped → unknown with hint', () => {
      const r = computeFleetState(makeDaemon(), makePeers({ status: 'skipped' }));
      expect(r.state).toBe('unknown');
      expect(r.hint).toContain('skipped');
      expect(r.hint).toContain('cannot classify');
    });

    it('peers.status=unavailable → unknown with hint', () => {
      const r = computeFleetState(makeDaemon(), makePeers({ status: 'unavailable' }));
      expect(r.state).toBe('unknown');
      expect(r.hint).toContain('unavailable');
    });
  });

  describe('isolated state (otherPeersInRegistry === 0)', () => {
    it('peerCount=0 AND connections=0 → isolated with "first agent" hint', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 0 }),
        makePeers({ peerCount: 0 }),
      );
      expect(r.state).toBe('isolated');
      expect(r.otherPeersInRegistry).toBe(0);
      expect(r.connections).toBe(0);
      expect(r.hint).toContain('first agent');
    });

    it('peerCount=1 (only me) + connections=0 → isolated, first-agent hint', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 0 }),
        makePeers({ peerCount: 1 }),
      );
      expect(r.state).toBe('isolated');
      expect(r.otherPeersInRegistry).toBe(0);
    });

    it('peerCount=1 + connections>0 → isolated, "registry not synced" hint', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 2 }),
        makePeers({ peerCount: 1 }),
      );
      expect(r.state).toBe('isolated');
      expect(r.hint).toContain('not yet synced');
    });
  });

  describe('fleet-dark state (others registered but 0 connections)', () => {
    it('peerCount=3 (2 others) + connections=0 → fleet-dark', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 0 }),
        makePeers({ peerCount: 3 }),
      );
      expect(r.state).toBe('fleet-dark');
      expect(r.otherPeersInRegistry).toBe(2);
      expect(r.connections).toBe(0);
      expect(r.hint).toContain('daemons may be down');
    });
  });

  describe('partial state (connections < othersInRegistry)', () => {
    it('2 others registered, 1 connected → partial', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 1 }),
        makePeers({ peerCount: 3 }),
      );
      expect(r.state).toBe('partial');
      expect(r.connections).toBe(1);
      expect(r.otherPeersInRegistry).toBe(2);
      expect(r.hint).toContain('1 of 2');
    });
  });

  describe('healthy state (connections >= othersInRegistry)', () => {
    it('2 others registered, 2 connected → healthy (no hint)', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 2 }),
        makePeers({ peerCount: 3 }),
      );
      expect(r.state).toBe('healthy');
      expect(r.hint).toBeUndefined();
    });

    it('2 others registered, 5 connected (public bootstrap peers) → healthy', () => {
      const r = computeFleetState(
        makeDaemon({ connections: 5 }),
        makePeers({ peerCount: 3 }),
      );
      expect(r.state).toBe('healthy');
    });
  });

  describe('stale registry (status=stale but data present)', () => {
    it('stale status still classifies — does not force unknown', () => {
      // Absorbed from aebfbc7 (duplicate test file, consolidated HB#349).
      // PeerRegistryReport.status='stale' means the registry data is older
      // than PEER_REGISTRY_STALE_SEC. Classification should still work.
      const r = computeFleetState(
        makeDaemon({ connections: 2 }),
        makePeers({ status: 'stale', peerCount: 3 }),
      );
      expect(r.state).toBe('healthy');
    });
  });

  describe('invariants', () => {
    it('otherPeersInRegistry is never negative (clamp at 0)', () => {
      // peerCount < 1 would naively produce -1; Math.max clamps
      const r = computeFleetState(makeDaemon(), makePeers({ peerCount: 0 }));
      expect(r.otherPeersInRegistry).toBe(0);
    });

    it('otherPeersInRegistry always reflects peerCount-1', () => {
      for (const count of [1, 2, 5, 10]) {
        const r = computeFleetState(makeDaemon(), makePeers({ peerCount: count }));
        expect(r.otherPeersInRegistry).toBe(count - 1);
      }
    });

    it('connections pass through unchanged', () => {
      for (const conns of [0, 1, 5, 100]) {
        const r = computeFleetState(
          makeDaemon({ connections: conns }),
          makePeers({ peerCount: 3 }),
        );
        expect(r.connections).toBe(conns);
      }
    });
  });
});

describe('checkUntrackedFiles (HB#618 loss-risk detector)', () => {
  it('returns clean when no untracked files', () => {
    const r = checkUntrackedFiles('');
    expect(r.status).toBe('clean');
    expect(r.untrackedSrcCount).toBe(0);
    expect(r.warning).toBeUndefined();
  });

  it('returns clean when untracked files are only non-src/', () => {
    const r = checkUntrackedFiles(
      '?? .claude/settings.local.json\n' +
      '?? agent/brain/Knowledge/foo.md\n' +
      '?? test/scripts/foo.js\n',
    );
    expect(r.status).toBe('clean');
    expect(r.untrackedSrcCount).toBe(0);
  });

  it('ignores modified (M) entries, only counts untracked (??)', () => {
    const r = checkUntrackedFiles(
      ' M src/lib/brain.ts\n' +
      ' M src/commands/foo.ts\n' +
      '?? src/lib/new.ts\n',
    );
    expect(r.untrackedSrcCount).toBe(1);
  });

  it('ignores .generated.md files in src/', () => {
    const r = checkUntrackedFiles(
      '?? src/data/foo.generated.md\n' +
      '?? src/lib/real.ts\n',
    );
    expect(r.untrackedSrcCount).toBe(1);
  });

  it('returns some when below threshold', () => {
    const r = checkUntrackedFiles(
      '?? src/commands/a.ts\n?? src/commands/b.ts\n',
      5,
    );
    expect(r.status).toBe('some');
    expect(r.untrackedSrcCount).toBe(2);
    expect(r.warning).toMatch(/review/);
  });

  it('returns loss-risk when at or above threshold', () => {
    const r = checkUntrackedFiles(
      [0,1,2,3,4,5].map(i => `?? src/commands/file${i}.ts`).join('\n'),
      5,
    );
    expect(r.status).toBe('loss-risk');
    expect(r.untrackedSrcCount).toBe(6);
    expect(r.warning).toMatch(/HB#617/);
  });

  it('includes sample paths (up to 3) in output', () => {
    const r = checkUntrackedFiles(
      '?? src/a.ts\n?? src/b.ts\n?? src/c.ts\n?? src/d.ts\n?? src/e.ts\n',
      5,
    );
    expect(r.samplePaths.length).toBe(3);
    expect(r.samplePaths).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('threshold is configurable', () => {
    const twoFiles = '?? src/a.ts\n?? src/b.ts\n';
    expect(checkUntrackedFiles(twoFiles, 2).status).toBe('loss-risk');
    expect(checkUntrackedFiles(twoFiles, 10).status).toBe('some');
  });
});

describe('checkUnpushedCommits (HB#373 commit-level loss-risk detector)', () => {
  it('returns clean when git log output is empty', () => {
    const r = checkUnpushedCommits('');
    expect(r.status).toBe('clean');
    expect(r.unpushedCount).toBe(0);
    expect(r.warning).toBeUndefined();
  });

  it('returns clean when output is just whitespace', () => {
    expect(checkUnpushedCommits('   \n  \n').status).toBe('clean');
  });

  it('counts each non-empty line as one unpushed commit', () => {
    const out = 'abc1234 First commit\ndef5678 Second commit\n';
    const r = checkUnpushedCommits(out, 10);
    expect(r.unpushedCount).toBe(2);
    expect(r.status).toBe('some');
  });

  it('returns loss-risk when count >= threshold', () => {
    const out = [0, 1, 2, 3, 4].map((i) => `abc${i} Commit ${i}`).join('\n');
    const r = checkUnpushedCommits(out, 3);
    expect(r.status).toBe('loss-risk');
    expect(r.unpushedCount).toBe(5);
    expect(r.warning).toMatch(/HB#373/);
  });

  it('returns some when below threshold', () => {
    const out = 'abc1 One\nabc2 Two\n';
    const r = checkUnpushedCommits(out, 5);
    expect(r.status).toBe('some');
    expect(r.warning).toMatch(/push before session-end/);
  });

  it('samples up to 3 commit subjects, strips sha prefix', () => {
    const out = [
      'abc1234 First thing',
      'def5678 Second thing',
      'ghi9abc Third thing',
      'jkl0123 Fourth thing',
    ].join('\n');
    const r = checkUnpushedCommits(out, 10);
    expect(r.sampleCommits.length).toBe(3);
    expect(r.sampleCommits[0]).toBe('First thing');
    expect(r.sampleCommits[1]).toBe('Second thing');
    expect(r.sampleCommits[2]).toBe('Third thing');
  });

  it('truncates long commit subjects to 80 chars', () => {
    const longSubject = 'x'.repeat(200);
    const r = checkUnpushedCommits(`abc1234 ${longSubject}`, 10);
    expect(r.sampleCommits[0].length).toBeLessThanOrEqual(80);
  });

  it('handles commits with no subject gracefully (unlikely but defensive)', () => {
    // `git log --oneline` always produces sha + subject; this guards a pathological case
    const r = checkUnpushedCommits('abc1234', 10);
    expect(r.unpushedCount).toBe(1);
    expect(r.sampleCommits[0]).toBe('abc1234');
  });

  it('threshold is configurable', () => {
    const out = 'a b\nc d\nd e\n';
    expect(checkUnpushedCommits(out, 2).status).toBe('loss-risk');
    expect(checkUnpushedCommits(out, 10).status).toBe('some');
  });

  it('real-world pattern: reproduces this session HB#348 unpushed-commit loss-risk scenario', () => {
    // Simulates the HB#348 state: 2 unpushed commits that had sat locally.
    const out = [
      '16ed90c how-i-think.md: Operational Discipline section (retro-344 change-1 + change-2)',
      '35076c4 session-start: fleet-state diagnostic (retro-344 change-4)',
    ].join('\n');
    // With default threshold of 3, 2 unpushed is 'some' — accurate for that HB.
    const r = checkUnpushedCommits(out);
    expect(r.status).toBe('some');
    expect(r.unpushedCount).toBe(2);
    expect(r.sampleCommits[0]).toMatch(/Operational Discipline/);
  });
});
