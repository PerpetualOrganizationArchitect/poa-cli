/**
 * Token Request Queries
 * Ported from frontend queries.js
 */

export const FETCH_PENDING_TOKEN_REQUESTS = `
  query FetchPendingTokenRequests($tokenAddress: String!) {
    tokenRequests(
      where: { participationToken: $tokenAddress, status: Pending }
      orderBy: createdAt
      orderDirection: desc
      first: 100
    ) {
      id
      requestId
      requester
      amount
      ipfsHash
      metadata {
        reason
        submittedAt
      }
      status
      createdAt
      createdAtBlock
      transactionHash
    }
  }
`;

export const FETCH_USER_TOKEN_REQUESTS = `
  query FetchUserTokenRequests($tokenAddress: String!, $userAddress: Bytes!) {
    tokenRequests(
      where: { participationToken: $tokenAddress, requester: $userAddress }
      orderBy: createdAt
      orderDirection: desc
      first: 50
    ) {
      id
      requestId
      amount
      ipfsHash
      metadata {
        reason
        submittedAt
      }
      status
      createdAt
      approvedAt
      cancelledAt
      approver
      transactionHash
    }
  }
`;

export const FETCH_ALL_TOKEN_REQUESTS = `
  query FetchAllTokenRequests($tokenAddress: String!) {
    tokenRequests(
      where: { participationToken: $tokenAddress }
      orderBy: createdAt
      orderDirection: desc
      first: 100
    ) {
      id
      requestId
      requester
      amount
      ipfsHash
      metadata {
        reason
        submittedAt
      }
      status
      createdAt
      approvedAt
      cancelledAt
      approver
      transactionHash
    }
  }
`;
