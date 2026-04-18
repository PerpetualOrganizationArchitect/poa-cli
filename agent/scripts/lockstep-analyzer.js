#!/usr/bin/env node
/**
 * E-direct lockstep analyzer — measures top-N voter coordination
 * on binary-choice proposals for a Snapshot space.
 *
 * Produces two metrics per v2.0.x tier diagnostic (sentinel HB#694):
 *   - all-agree rate: proposals where ALL top-N voted identically
 *   - pairwise-with-top-1 rate: per each top-k (k>=2), agreement with top-1
 *
 * Tier classification:
 *   - STRONG: all-agree ≥ 0.70
 *   - PAIRWISE-ONLY: majority pairwise ≥ 0.70 but all-agree < 0.70
 *   - None: majority pairwise < 0.70
 *
 * Usage:
 *   node agent/scripts/lockstep-analyzer.js <space.eth> [topN=5]
 */

const https = require('https');

const SNAPSHOT_URL = 'https://hub.snapshot.org/graphql';

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      SNAPSHOT_URL,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          try { resolve(JSON.parse(out).data); } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fetchProposals(space, first = 1000) {
  // Fetch closed proposals, restrict to those with exactly 2 choices (binary)
  const q = `query($space: String!, $first: Int!) {
    proposals(first: $first, where: { space: $space, state: "closed" }, orderBy: "created", orderDirection: desc) {
      id type choices scores_total
    }
  }`;
  const d = await gql(q, { space, first });
  return (d.proposals || []).filter(p => p.choices && p.choices.length === 2);
}

async function fetchVotes(proposalIds, voterAddrs) {
  // Snapshot's votes API has 1000 limit per page. Batch by proposal to stay
  // under the limit. For each proposal, query votes filtered to voterAddrs.
  const q = `query($pid: String!, $voters: [String!]!) {
    votes(first: 1000, where: { proposal: $pid, voter_in: $voters }) {
      proposal { id }
      voter
      choice
      vp
    }
  }`;
  const all = [];
  for (const pid of proposalIds) {
    const d = await gql(q, { pid, voters: voterAddrs });
    if (d && d.votes) all.push(...d.votes);
  }
  return all;
}

async function fetchTopVoters(space, topN) {
  // Snapshot schema: votes has `space { id }` nested — not `space` directly.
  // Page through votes ordered by vp desc.
  const q = `query($space: String!, $first: Int!, $skip: Int!) {
    votes(first: $first, skip: $skip, where: { space: $space }, orderBy: "vp", orderDirection: desc) {
      voter vp
    }
  }`;
  const byVoter = new Map();
  for (let page = 0; page < 4; page++) {
    const d = await gql(q, { space, first: 1000, skip: page * 1000 });
    const votes = (d && d.votes) || [];
    if (votes.length === 0) break;
    for (const v of votes) {
      const addr = v.voter.toLowerCase();
      byVoter.set(addr, (byVoter.get(addr) || 0) + Number(v.vp || 0));
    }
    if (votes.length < 1000) break;
  }
  const sorted = Array.from(byVoter.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, topN).map(([addr, vp]) => ({ address: addr, cumulativeVP: vp }));
}

async function main() {
  const space = process.argv[2];
  const topN = Number(process.argv[3] || 5);
  if (!space) { console.error('Usage: node lockstep-analyzer.js <space.eth> [topN=5]'); process.exit(1); }

  console.log(`\nLockstep analysis: ${space} (top-${topN})\n`);

  const topVoters = await fetchTopVoters(space, topN);
  console.log('Top voters by cumulative VP (from last 20K votes):');
  topVoters.forEach((v, i) => console.log(`  ${i + 1}. ${v.address}  cum-VP=${v.cumulativeVP.toLocaleString()}`));

  const binaryProposals = await fetchProposals(space, 1000);
  console.log(`\nBinary proposals found: ${binaryProposals.length}\n`);
  if (binaryProposals.length === 0) {
    console.log('No binary proposals available. Space may use multi-choice or gauge-allocation voting.');
    return;
  }

  const voterAddrs = topVoters.map(v => v.address);
  const proposalIds = binaryProposals.map(p => p.id);
  const votes = await fetchVotes(proposalIds, voterAddrs);
  console.log(`Binary-proposal votes by top-${topN}: ${votes.length}\n`);

  // Index: proposal → { voter → choice }
  const byProposal = new Map();
  for (const v of votes) {
    const pid = v.proposal.id;
    if (!byProposal.has(pid)) byProposal.set(pid, {});
    byProposal.get(pid)[v.voter.toLowerCase()] = v.choice;
  }

  // Metric 1: ALL-AGREE across proposals where ALL top-N voted
  let allAgreed = 0, allCoparticipated = 0;
  const perPair = new Map(); // top-k → { coVoted, agreed }
  for (let k = 1; k < topN; k++) perPair.set(k, { coVoted: 0, agreed: 0 });

  for (const [pid, choices] of byProposal.entries()) {
    const top1Choice = choices[voterAddrs[0]];
    if (top1Choice === undefined) continue;
    // Pairwise-with-top-1
    for (let k = 1; k < topN; k++) {
      const cho = choices[voterAddrs[k]];
      if (cho !== undefined) {
        perPair.get(k).coVoted++;
        if (cho === top1Choice) perPair.get(k).agreed++;
      }
    }
    // All-agree
    const allPresent = voterAddrs.every(a => choices[a] !== undefined);
    if (allPresent) {
      allCoparticipated++;
      const all = voterAddrs.map(a => choices[a]);
      if (all.every(c => c === all[0])) allAgreed++;
    }
  }

  const allAgreeRate = allCoparticipated ? allAgreed / allCoparticipated : 0;
  console.log(`ALL-AGREE rate: ${allAgreed}/${allCoparticipated} = ${(allAgreeRate * 100).toFixed(1)}%`);
  console.log('Pairwise-with-top-1 rates:');
  const pairwiseRates = [];
  for (let k = 1; k < topN; k++) {
    const { coVoted, agreed } = perPair.get(k);
    const rate = coVoted ? agreed / coVoted : 0;
    pairwiseRates.push(rate);
    console.log(`  top-${k + 1}: ${agreed}/${coVoted} = ${(rate * 100).toFixed(1)}% (vs top-1)`);
  }
  const majorityPairwise = pairwiseRates.filter(r => r >= 0.70).length;

  let tier = 'None';
  if (allAgreeRate >= 0.70) tier = 'STRONG';
  else if (majorityPairwise > pairwiseRates.length / 2) tier = 'PAIRWISE-ONLY';

  console.log(`\n=== E-direct tier: ${tier} ===`);
  console.log(`(all-agree ${(allAgreeRate * 100).toFixed(1)}%; pairwise≥70% in ${majorityPairwise}/${pairwiseRates.length} pairs)\n`);

  console.log('JSON:');
  console.log(JSON.stringify({
    space, topN, binaryProposals: binaryProposals.length, allCoparticipated, allAgreed, allAgreeRate,
    pairwiseRates, majorityPairwise, tier, topVoters,
  }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
