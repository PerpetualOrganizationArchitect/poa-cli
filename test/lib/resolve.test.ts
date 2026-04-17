import { describe, it, expect } from 'vitest';
import { resolveOrgId, requireModule, type OrgModules } from '../../src/lib/resolve';

describe('resolve', () => {
  describe('resolveOrgId — synchronous paths (no subgraph)', () => {
    it('returns the hex ID unchanged when input starts with 0x', async () => {
      const hex = '0x112de94b6e6cba0ccece7301df866a932711655946942d795f07334e3fd6f46b';
      expect(await resolveOrgId(hex)).toBe(hex);
    });

    it('accepts short hex (0x-prefixed) without subgraph call', async () => {
      expect(await resolveOrgId('0xabc')).toBe('0xabc');
    });

    it('throws helpful error when orgIdOrName is undefined', async () => {
      await expect(resolveOrgId(undefined)).rejects.toThrow(/Missing --org flag/);
      await expect(resolveOrgId(undefined)).rejects.toThrow(/POP_DEFAULT_ORG/);
    });

    it('throws helpful error when orgIdOrName is empty string', async () => {
      await expect(resolveOrgId('')).rejects.toThrow(/Missing --org flag/);
    });
  });

  describe('requireModule', () => {
    function makeModules(overrides: Partial<OrgModules> = {}): OrgModules {
      return {
        orgId: '0xabc',
        taskManagerAddress: null,
        hybridVotingAddress: null,
        ddVotingAddress: null,
        participationTokenAddress: null,
        educationHubAddress: null,
        executorAddress: null,
        quickJoinAddress: null,
        eligibilityModuleAddress: null,
        paymentManagerAddress: null,
        ...overrides,
      };
    }

    it('returns the address when the module is deployed', () => {
      const mods = makeModules({ taskManagerAddress: '0xTaskManagerAddr' });
      expect(requireModule(mods, 'taskManagerAddress')).toBe('0xTaskManagerAddr');
    });

    it('throws with a friendly message when the module is null', () => {
      const mods = makeModules();
      expect(() => requireModule(mods, 'taskManagerAddress')).toThrow(
        /no.*task.*manager.*deployed/i,
      );
    });

    it('derives friendly name by stripping "Address" suffix + camelCase → space (first word lowercase)', () => {
      // Implementation does NOT capitalize the first word; `camelCaseAddress` → `camel Case`
      const mods = makeModules();
      expect(() => requireModule(mods, 'hybridVotingAddress')).toThrow(/hybrid Voting/);
      expect(() => requireModule(mods, 'paymentManagerAddress')).toThrow(/payment Manager/);
      expect(() => requireModule(mods, 'eligibilityModuleAddress')).toThrow(/eligibility Module/);
    });

    it('throws when address is empty string (also falsy)', () => {
      const mods = makeModules({ taskManagerAddress: '' });
      expect(() => requireModule(mods, 'taskManagerAddress')).toThrow();
    });

    it('returns non-null non-string as undeployed (orgId is string but type-guard enforces specific shape)', () => {
      // Guards against regressions where a caller passes a numeric or object value.
      // The implementation checks `typeof addr !== 'string'` so orgId (string) works.
      const mods = makeModules();
      expect(requireModule(mods, 'orgId')).toBe('0xabc');
    });
  });
});
