# audit-governor subgraph-backed audits (Task #471)

`pop org audit-governor` supports two event-fetch paths:

1. **RPC event scanning** (default, option a, Task #467): `--blocks N`, `--from-block N`, `--to-block N`. Works on Ethereum mainnet + any chain with generous `eth_getLogs` limits.
2. **Subgraph GraphQL** (option b, Task #471): `--subgraph-url <url>` + `--subgraph-query-file <path>`. Bypasses L2 RPC rate limits.

## When to use the subgraph path

The RPC path breaks on high-throughput L2s (Arbitrum ~0.25s/block, Optimism ~2s/block, Base ~2s/block). Even with `--from-block`/`--to-block`, public L2 RPCs enforce strict `eth_getLogs` block-range caps (Arbitrum: 50K strictly). Chunked scanning hits rate limits under `Promise.all(4)` concurrency.

Use the subgraph path when:
- Auditing an L2 governor (Arbitrum/Optimism/Base)
- The DAO has a known public subgraph on The Graph Studio / gateway
- You need results in <60s

Use the RPC path when:
- Auditing an Ethereum mainnet governor
- No subgraph exists for the target DAO
- You want to verify specific block-range scans

## Quick start

```bash
# Copy the example query file
cp examples/audit-governor/subgraph-query.graphql /tmp/my-gov-query.graphql

# Edit the file to match your subgraph's schema if field names differ
# (e.g. your subgraph may use `votes` instead of `voteCasts`)

# Run the audit
pop org audit-governor \
  --address 0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9 \
  --chain 42161 \
  --subgraph-url https://api.thegraph.com/subgraphs/name/YOUR-SUBGRAPH \
  --subgraph-query-file /tmp/my-gov-query.graphql \
  --json
```

## Expected subgraph response shape

```typescript
{
  proposalsCreated: Array<{
    proposalId: string | bigint;
    proposer: string;
    // optional additional fields — ignored by audit-governor
  }>;
  proposalsExecuted: Array<{ proposalId: string | bigint }>;
  proposalsCanceled: Array<{ proposalId: string | bigint }>;
  voteCasts: Array<{
    voter: string;
    weight: string | number;  // will be coerced to BigInt
    support: number | string; // 0 = against, 1 = for, 2 = abstain
    proposalId: string | bigint;
    reason?: string;
  }>;
}
```

## Field-name variants

Different subgraphs name the same data differently. If your subgraph uses
different field names, rename them in your query's selection set to match
the expected shape. The transport layer doesn't care what aliases you use
in the GraphQL source — only that the final JSON has the 4 top-level arrays.

Example alias rewrite (for a subgraph that calls votes `VoteCast`):
```graphql
query {
  voteCasts: voteCast(first: 5000) { ... }
}
```

## Error scenarios

- **`--subgraph-url requires --subgraph-query-file`**: flag pair enforced at runtime. Provide both.
- **`--subgraph-query-file not found`**: path doesn't exist. Check relative paths.
- **GraphQL errors**: the subgraph returned an error response. Usually means schema mismatch between your query and the subgraph. Check field names.
- **Empty arrays**: the subgraph has no data for this governor. Verify the address is lowercase + matches the subgraph's indexed set.

## Known working subgraph patterns

- OpenZeppelin Governor standard subgraphs typically match the example query above
- Tally-hosted subgraphs use similar field names
- Custom subgraphs (like governance-specific forks) may differ; always check the subgraph's schema.graphql

## Contributing

If you successfully audit a specific DAO via this path, consider shipping the (DAO, subgraph URL, query file) triple as a repo-tracked example so future callers can reproduce your audit without guessing.
