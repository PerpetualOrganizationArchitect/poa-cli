import { describe, it, expect } from 'vitest';
import {
  computeFleetState,
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
