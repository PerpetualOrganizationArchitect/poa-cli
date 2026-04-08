/**
 * Treasury Queries
 * Ported from frontend queries.js
 */

export const FETCH_TREASURY_DATA = `
  query FetchTreasuryData($orgId: Bytes!) {
    organization(id: $orgId) {
      id
      executorContract {
        id
        isPaused
        owner
        allowedCaller
        sweeps(first: 50, orderBy: sweptAt, orderDirection: desc) {
          id
          to
          amount
          sweptAt
          transactionHash
        }
      }
      participationToken {
        id
        name
        symbol
        totalSupply
      }
      paymentManager {
        id
        owner
        revenueShareToken
        distributionCounter
        distributions(first: 100, orderBy: createdAt, orderDirection: desc) {
          id
          distributionId
          payoutToken
          totalAmount
          totalClaimed
          checkpointBlock
          merkleRoot
          status
          createdAt
          finalizedAt
          unclaimedAmount
          claims(first: 200) {
            id
            claimer
            claimerUsername
            amount
            claimedAt
            transactionHash
          }
        }
        payments(first: 100, orderBy: receivedAt, orderDirection: desc) {
          id
          payer
          payerUsername
          amount
          token
          receivedAt
          transactionHash
        }
      }
    }
  }
`;
