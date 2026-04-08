/**
 * Voting Queries
 * Ported from frontend queries.js
 */

export const FETCH_VOTING_DATA = `
  query FetchVotingDataNew($orgId: Bytes!) {
    organization(id: $orgId) {
      id
      hybridVoting {
        id
        thresholdPct
        quorum
        votingClasses(where: { isActive: true }, orderBy: classIndex, orderDirection: asc) {
          id
          classIndex
          version
          strategy
          slicePct
          quadratic
          minBalance
          asset
          hatIds
          isActive
        }
        proposals(orderBy: startTimestamp, orderDirection: desc, first: 50) {
          id
          proposalId
          title
          descriptionHash
          metadata {
            id
            description
            optionNames
          }
          numOptions
          startTimestamp
          endTimestamp
          status
          winningOption
          isValid
          wasExecuted
          isHatRestricted
          restrictedHatIds
          votes {
            voter
            voterUsername
            optionIndexes
            optionWeights
            classRawPowers
            votedAt
          }
        }
      }
      directDemocracyVoting {
        id
        thresholdPct
        quorum
        ddvProposals(orderBy: startTimestamp, orderDirection: desc, first: 50) {
          id
          proposalId
          title
          descriptionHash
          metadata {
            id
            description
            optionNames
          }
          numOptions
          startTimestamp
          endTimestamp
          status
          winningOption
          isValid
          isHatRestricted
          restrictedHatIds
          votes {
            voter
            optionIndexes
            optionWeights
          }
        }
      }
    }
  }
`;
