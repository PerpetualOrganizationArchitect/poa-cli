/**
 * User & Account Queries
 * Ported from frontend queries.js
 */

export const FETCH_USERNAME = `
  query FetchUsernameNew($id: Bytes!) {
    account(id: $id) {
      id
      username
      profileMetadataHash
      metadata {
        id
        bio
        avatar
        github
        twitter
        website
      }
    }
  }
`;

export const GET_ACCOUNT_BY_USERNAME = `
  query GetAccountByUsername($username: String!) {
    accounts(where: { username: $username }, first: 1) {
      id
      user
      username
    }
  }
`;

export const FETCH_USER_DATA = `
  query FetchUserDataNew($orgUserID: String!, $userAddress: Bytes!) {
    user(id: $orgUserID) {
      id
      address
      participationTokenBalance
      membershipStatus
      currentHatIds
      joinMethod
      totalTasksCompleted
      totalVotes
      totalModulesCompleted
      firstSeenAt
      lastActiveAt
      assignedTasks(first: 20) {
        id
        taskId
        title
        payout
        status
      }
      completedTasks(first: 20) {
        id
        taskId
        title
        payout
      }
      hybridProposalsCreated(first: 20) {
        id
        proposalId
        title
        status
        startTimestamp
        endTimestamp
      }
      modulesCompleted(first: 20) {
        moduleId
        completedAt
      }
    }
    account(id: $userAddress) {
      id
      username
    }
  }
`;
