import { describe, it, expect } from 'vitest';
import {
  computeFleetState,
  type DaemonReport,
  type PeerRegistryReport,
  type FleetReport,
} from '../../src/commands/agent/session-start';

function mkDaemon(conns: number): DaemonReport {
  return {
    status: 'running',
    pid: 1234,
    connections: conns,
    knownPeerCount: 0,
    topics: 8,
    uptimeSec: 3600,
    missingCanonicalSubs: [],
  };
}

function mkPeers(status: PeerRegistryReport['status'], peerCount: number): PeerRegistryReport {
  return {
    status,
    peerCount,
    oldestAgeSec: peerCount > 0 ? 30 : null,
  };
}

describe('computeFleetState', () => {
  it('returns unknown when registry is skipped', () => {
    const f = computeFleetState(mkDaemon(0), mkPeers('skipped', 0));
    expect(f.state).toBe('unknown');
    expect(f.hint).toMatch(/registry check/);
  });

  it('returns unknown when registry is unavailable', () => {
    const f = computeFleetState(mkDaemon(3), mkPeers('unavailable', 0));
    expect(f.state).toBe('unknown');
  });

  it('returns isolated when no others in registry + no connections', () => {
    // peerCount=1 means only my entry
    const f = computeFleetState(mkDaemon(0), mkPeers('fresh', 1));
    expect(f.state).toBe('isolated');
    expect(f.otherPeersInRegistry).toBe(0);
    expect(f.hint).toMatch(/first agent|never published/);
  });

  it('returns isolated with registry-sync hint when conn>0 but registry empty', () => {
    const f = computeFleetState(mkDaemon(1), mkPeers('fresh', 1));
    expect(f.state).toBe('isolated');
    expect(f.connections).toBe(1);
    expect(f.hint).toMatch(/not yet synced|registry shows none/);
  });

  it('returns fleet-dark when others registered but 0 connections', () => {
    // peerCount=3: me + 2 others
    const f = computeFleetState(mkDaemon(0), mkPeers('fresh', 3));
    expect(f.state).toBe('fleet-dark');
    expect(f.otherPeersInRegistry).toBe(2);
    expect(f.hint).toMatch(/0 reachable|daemons may be down/);
  });

  it('returns partial when some but not all registered peers reachable', () => {
    // peerCount=3: me + 2 others, connected to 1
    const f = computeFleetState(mkDaemon(1), mkPeers('fresh', 3));
    expect(f.state).toBe('partial');
    expect(f.otherPeersInRegistry).toBe(2);
    expect(f.connections).toBe(1);
    expect(f.hint).toMatch(/1 of 2/);
  });

  it('returns healthy when conns equal othersInRegistry', () => {
    const f = computeFleetState(mkDaemon(2), mkPeers('fresh', 3));
    expect(f.state).toBe('healthy');
    expect(f.hint).toBeUndefined();
  });

  it('returns healthy when conns exceed othersInRegistry (bootstrap peers)', () => {
    // connections can exceed registry when libp2p bootstrap peers are counted
    const f = computeFleetState(mkDaemon(5), mkPeers('fresh', 3));
    expect(f.state).toBe('healthy');
  });

  it('handles peerCount=0 defensively (subtract clamps to 0)', () => {
    const f = computeFleetState(mkDaemon(0), mkPeers('empty', 0));
    expect(f.otherPeersInRegistry).toBe(0);
    expect(f.state).toBe('isolated');
  });

  it('handles stale registry status', () => {
    const f = computeFleetState(mkDaemon(2), mkPeers('stale', 3));
    expect(f.state).toBe('healthy');  // stale still valid for classification
  });
});
