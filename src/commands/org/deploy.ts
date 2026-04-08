import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract, createReadContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { ipfsCidToBytes32, stringToBytes32 } from '../../lib/encoding';
import { query } from '../../lib/subgraph';
import { FETCH_INFRASTRUCTURE_ADDRESSES } from '../../queries/infrastructure';
import type { InfrastructureAddresses } from '../../queries/infrastructure';
import * as output from '../../lib/output';
import fs from 'fs';

interface DeployArgs {
  config: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

/**
 * Org deploy config file schema.
 * Matches the DeploymentParams struct expected by OrgDeployer.deployFullOrg()
 */
interface OrgDeployConfig {
  orgName: string;
  description?: string;
  links?: Array<{ name: string; url: string }>;
  autoUpgrade?: boolean;
  hybridVoting: {
    thresholdPct: number;
    classes: Array<{
      strategy: 'DIRECT' | 'ERC20_BAL';
      slicePct: number;
      quadratic?: boolean;
      minBalance?: string;
      asset?: string;
      hatIds?: number[];
    }>;
  };
  directDemocracy: {
    thresholdPct: number;
  };
  roles: Array<{
    name: string;
    image?: string;
    canVote: boolean;
    vouching?: {
      enabled: boolean;
      quorum: number;
      voucherRoleIndex: number;
      combineWithHierarchy?: boolean;
    };
    defaults?: {
      eligible: boolean;
      standing: boolean;
    };
    hierarchy?: {
      adminRoleIndex: number;
    };
    distribution?: {
      mintToDeployer: boolean;
      additionalWearers?: string[];
    };
    hatConfig?: {
      maxSupply: number;
      mutableHat: boolean;
    };
  }>;
  roleAssignments: {
    quickJoinRoles: number[];
    tokenMemberRoles: number[];
    tokenApproverRoles: number[];
    taskCreatorRoles: number[];
    educationCreatorRoles?: number[];
    educationMemberRoles?: number[];
    hybridProposalCreatorRoles: number[];
    ddVotingRoles: number[];
    ddCreatorRoles: number[];
  };
  metadataAdminRoleIndex?: number;
  educationHub?: { enabled: boolean };
  paymaster?: {
    operatorRoleIndex: number;
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
    defaultBudgetCapPerEpoch: string;
    defaultBudgetEpochLen: number;
  };
}

function indicesToBitmap(indices: number[]): ethers.BigNumber {
  let bitmap = ethers.BigNumber.from(0);
  for (const i of indices) {
    bitmap = bitmap.or(ethers.BigNumber.from(1).shl(i));
  }
  return bitmap;
}

export const deployHandler = {
  builder: (yargs: Argv) => yargs
    .option('config', {
      type: 'string',
      demandOption: true,
      describe: 'Path to org deploy config JSON file',
    }),

  handler: async (argv: ArgumentsCamelCase<DeployArgs>) => {
    const spin = output.spinner('Deploying organization...');
    spin.start();

    try {
      // Read and validate config
      const configPath = argv.config;
      if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
      }
      const config: OrgDeployConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      if (!config.orgName) throw new Error('Config missing: orgName');
      if (!config.roles?.length) throw new Error('Config missing: roles');
      if (!config.hybridVoting) throw new Error('Config missing: hybridVoting');

      const { signer, address } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Resolve infrastructure addresses
      spin.text = 'Resolving infrastructure addresses...';
      const infra = await query<InfrastructureAddresses>(
        FETCH_INFRASTRUCTURE_ADDRESSES,
        {},
        argv.chain
      );

      const orgDeployerAddr = infra.poaManagerContracts?.[0]?.orgDeployerProxy;
      const registryAddr = infra.poaManagerContracts?.[0]?.globalAccountRegistryProxy;
      if (!orgDeployerAddr) throw new Error('Could not resolve OrgDeployer address');
      if (!registryAddr) throw new Error('Could not resolve UniversalAccountRegistry address');

      // Generate orgId: keccak256(orgName.toLowerCase().replace(/\s+/g, '-'))
      const normalizedName = config.orgName.toLowerCase().replace(/\s+/g, '-');
      const orgId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(normalizedName));

      // Upload org metadata to IPFS
      spin.text = 'Pinning org metadata to IPFS...';
      const metadata = {
        description: config.description || '',
        links: (config.links || []).map((l, i) => ({ ...l, index: i })),
        template: 'default',
        logo: null,
        backgroundColor: null,
        hideTreasury: false,
      };
      const metaCid = await pinJson(JSON.stringify(metadata));
      const metadataHash = ipfsCidToBytes32(metaCid);

      // Get registration nonce for deployer
      spin.text = 'Getting registration nonce...';
      const registryContract = createReadContract(registryAddr, 'UniversalAccountRegistry', signer.provider);
      const regNonce = await registryContract.nonces(address);
      const regDeadline = Math.floor(Date.now() / 1000) + 300; // 5 min

      // Sign EIP-712 registration message
      spin.text = 'Signing registration...';
      const domain = {
        name: 'UniversalAccountRegistry',
        version: '1',
        chainId: await signer.getChainId(),
        verifyingContract: registryAddr,
      };
      const types = {
        Register: [
          { name: 'user', type: 'address' },
          { name: 'username', type: 'string' },
          { name: 'deadline', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
        ],
      };
      const regMessage = {
        user: address,
        username: normalizedName,
        deadline: regDeadline,
        nonce: regNonce.toString(),
      };
      const regSignature = await signer._signTypedData(domain, types, regMessage);

      // Build hybrid voting classes
      // ABI: strategy(uint8), slicePct(uint8), quadratic(bool), minBalance(uint256), asset(address), hatIds(uint256[])
      const hybridClasses = config.hybridVoting.classes.map((c) => [
        c.strategy === 'DIRECT' ? 0 : 1,       // uint8
        c.slicePct,                              // uint8 (0-100)
        c.quadratic || false,                    // bool
        c.minBalance ? ethers.utils.parseUnits(c.minBalance, 18) : 0, // uint256
        c.asset || ethers.constants.AddressZero, // address
        c.hatIds || [],                          // uint256[]
      ]);

      // Build role configs
      // ABI: name(string), image(string), metadataCID(bytes32), canVote(bool),
      //      vouching(tuple), defaults(tuple), hierarchy(tuple), distribution(tuple), hatConfig(tuple)
      const MAX_UINT32 = 4294967295; // 2^32 - 1
      const roles = config.roles.map((r) => [
        r.name,                                  // string
        r.image || '',                           // string
        ethers.constants.HashZero,               // bytes32 metadataCID
        r.canVote,                               // bool
        [ // vouching: enabled(bool), quorum(uint32), voucherRoleIndex(uint256), combineWithHierarchy(bool)
          r.vouching?.enabled || false,
          r.vouching?.quorum || 0,
          r.vouching?.voucherRoleIndex ?? ethers.constants.MaxUint256,
          r.vouching?.combineWithHierarchy || false,
        ],
        [ // defaults: eligible(bool), standing(bool)
          r.defaults?.eligible ?? true,
          r.defaults?.standing ?? true,
        ],
        [ // hierarchy: adminRoleIndex(uint256)
          r.hierarchy?.adminRoleIndex ?? ethers.constants.MaxUint256,
        ],
        [ // distribution: mintToDeployer(bool), additionalWearers(address[])
          r.distribution?.mintToDeployer ?? true,
          r.distribution?.additionalWearers || [],
        ],
        [ // hatConfig: maxSupply(uint32), mutableHat(bool)
          r.hatConfig?.maxSupply ?? MAX_UINT32,  // uint32, NOT uint256
          r.hatConfig?.mutableHat ?? true,
        ],
      ]);

      // Build role assignment bitmaps
      const ra = config.roleAssignments;
      const roleAssignments = [
        indicesToBitmap(ra.quickJoinRoles),
        indicesToBitmap(ra.tokenMemberRoles),
        indicesToBitmap(ra.tokenApproverRoles),
        indicesToBitmap(ra.taskCreatorRoles),
        indicesToBitmap(ra.educationCreatorRoles || []),
        indicesToBitmap(ra.educationMemberRoles || []),
        indicesToBitmap(ra.hybridProposalCreatorRoles),
        indicesToBitmap(ra.ddVotingRoles),
        indicesToBitmap(ra.ddCreatorRoles),
      ];

      // Build paymaster config
      // ABI: operatorRoleIndex(uint256), autoWhitelistContracts(bool),
      //      maxFeePerGas(uint256), maxPriorityFeePerGas(uint256),
      //      maxCallGas(uint32), maxVerificationGas(uint32), maxPreVerificationGas(uint32),
      //      defaultBudgetCapPerEpoch(uint128), defaultBudgetEpochLen(uint32)
      const pm = config.paymaster;
      const paymasterConfig = pm ? [
        pm.operatorRoleIndex,                                    // uint256
        true,                                                    // bool
        ethers.utils.parseUnits(pm.maxFeePerGas, 'gwei'),       // uint256
        ethers.utils.parseUnits(pm.maxPriorityFeePerGas, 'gwei'), // uint256
        500000,                                                  // uint32 maxCallGas
        500000,                                                  // uint32 maxVerificationGas
        100000,                                                  // uint32 maxPreVerificationGas
        ethers.utils.parseEther(pm.defaultBudgetCapPerEpoch),   // uint128
        pm.defaultBudgetEpochLen,                                // uint32
      ] : [
        ethers.constants.MaxUint256, // operatorRoleIndex = MaxUint256 disables paymaster
        false,                       // autoWhitelistContracts
        0,                           // maxFeePerGas
        0,                           // maxPriorityFeePerGas
        0,                           // maxCallGas
        0,                           // maxVerificationGas
        0,                           // maxPreVerificationGas
        0,                           // defaultBudgetCapPerEpoch
        0,                           // defaultBudgetEpochLen
      ];

      // Build the full DeploymentParams struct
      // ABI field order: orgId, orgName, metadataHash, registryAddr, deployerAddress,
      //   deployerUsername, regDeadline, regNonce, regSignature, autoUpgrade,
      //   hybridThresholdPct, ddThresholdPct, hybridClasses, ddInitialTargets,
      //   roles, roleAssignments, metadataAdminRoleIndex, passkeyEnabled,
      //   educationHubConfig, bootstrap, paymasterConfig
      const deployParams = [
        orgId,                                                   // bytes32
        config.orgName,                                          // string
        metadataHash,                                            // bytes32
        registryAddr,                                            // address
        address,                                                 // address deployerAddress
        normalizedName,                                          // string deployerUsername
        regDeadline,                                             // uint256
        regNonce,                                                // uint256
        regSignature,                                            // bytes
        config.autoUpgrade ?? true,                              // bool
        config.hybridVoting.thresholdPct,                        // uint8
        config.directDemocracy?.thresholdPct || 51,              // uint8
        hybridClasses,                                           // ClassConfig[]
        [],                                                      // address[] ddInitialTargets
        roles,                                                   // RoleConfig[]
        roleAssignments,                                         // RoleAssignments struct
        config.metadataAdminRoleIndex ?? ethers.constants.MaxUint256, // uint256
        true,                                                    // bool passkeyEnabled
        [config.educationHub?.enabled ?? true],                  // EducationHubConfig struct
        [[], []],                                                // BootstrapConfig struct (projects, tasks)
        paymasterConfig,                                         // PaymasterConfig struct
      ];

      spin.text = 'Sending deploy transaction...';
      const contract = createWriteContract(orgDeployerAddr, 'OrgDeployerNew', signer);
      const result = await executeTx(
        contract,
        'deployFullOrg',
        [deployParams],
        { dryRun: argv.dryRun, gasLimit: 10000000 }
      );

      spin.stop();

      if (result.success) {
        output.success('Organization deployed', {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          orgId,
          orgName: config.orgName,
          metadataCid: metaCid,
          gasUsed: result.gasUsed,
        });
      } else {
        output.error('Org deployment failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
