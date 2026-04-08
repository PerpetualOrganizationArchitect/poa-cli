/**
 * Vouching Queries
 * Ported from frontend queries.js
 */

export const FETCH_VOUCHES_FOR_ORG = `
  query FetchVouchesForOrg($eligibilityModuleId: Bytes!) {
    vouches(
      where: { eligibilityModule: $eligibilityModuleId, isActive: true }
      orderBy: createdAt
      orderDirection: desc
      first: 200
    ) {
      id
      hatId
      wearer
      wearerUsername
      voucher
      voucherUsername
      vouchCount
      isActive
      createdAt
    }
  }
`;
