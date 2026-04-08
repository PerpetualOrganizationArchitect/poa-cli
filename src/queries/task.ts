/**
 * Task & Project Queries
 * Ported from frontend queries.js
 */

export const FETCH_PROJECTS_DATA = `
  query FetchProjectsDataNew($orgId: Bytes!) {
    organization(id: $orgId) {
      id
      taskManager {
        id
        creatorHatIds
        projects(where: { deleted: false }, first: 50) {
          id
          title
          metadataHash
          metadata {
            id
            description
          }
          cap
          bountyCaps {
            token
            cap
          }
          createdAt
          rolePermissions {
            hatId
            canCreate
            canClaim
            canReview
            canAssign
          }
          tasks(first: 1000, orderBy: taskId, orderDirection: desc) {
            id
            taskId
            title
            metadataHash
            submissionHash
            rejectionHash
            rejectionCount
            metadata {
              id
              name
              description
              difficulty
              estimatedHours
              submission
              rejection
            }
            rejections(orderBy: rejectedAt, orderDirection: desc, first: 10) {
              rejectorUsername
              rejectedAt
              metadata {
                rejection
              }
            }
            payout
            bountyToken
            bountyPayout
            status
            assignee
            assigneeUsername
            completer
            completerUsername
            requiresApplication
            createdAt
            assignedAt
            submittedAt
            completedAt
            applications {
              applicant
              applicantUsername
              applicationHash
              metadata {
                notes
                experience
              }
              approved
              approver
              approverUsername
              appliedAt
            }
          }
        }
      }
    }
  }
`;
