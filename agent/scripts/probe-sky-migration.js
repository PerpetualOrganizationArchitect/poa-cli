// Sky Protocol voter-overlap probe: historical MKR Chief voters vs current SKY holders
const { ethers } = require('ethers');

// SKY token on mainnet (per Sky's docs: 0x56072C95FAA701256059aa122697B133aDEd9279)
const SKY_TOKEN = '0x56072C95FAA701256059aa122697B133aDEd9279';
// MKR → SKY migration ratio: 1 MKR = 24000 SKY
const MIGRATION_RATIO = 24000n;

// Top-5 MKR Chief voters from HB#409 audit-dschief run (blocks 19.5M-20M pre-Endgame)
const TOP5_CHIEF_VOTERS = [
  { address: '0xa346c2eea05bb32c986ff755b2f19d2f0ba8d14c', chiefMKR: 13999 },
  { address: '0x5fac03e07447c1a3f4ad9a5f778f23c9e1fc4255', chiefMKR: 9000 },
  { address: '0xde08aef2b221274231b3547491ec8f0fc80917e1', chiefMKR: 8050 },
  { address: '0x69b576a7e193a15a570ee5bb2149deb3f03537a2', chiefMKR: 8000.02 },
  { address: '0xfe61acc408b63a5a03507a224398fa1fe8143f28', chiefMKR: 2978.68 },
];

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)'];
const MKR_TOKEN = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

async function main() {
  const rpc = process.env.POP_MAINNET_RPC || 'https://ethereum.publicnode.com';
  const provider = new ethers.providers.StaticJsonRpcProvider({ url: rpc, timeout: 30000 }, { chainId: 1, name: 'mainnet' });
  const sky = new ethers.Contract(SKY_TOKEN, ERC20_ABI, provider);

  const decimals = await sky.decimals();
  const totalSupply = await sky.totalSupply();
  console.log('SKY totalSupply:', ethers.utils.formatUnits(totalSupply, decimals));
  console.log('SKY decimals:', decimals);
  console.log('');

  const mkr = new ethers.Contract(MKR_TOKEN, ERC20_ABI, provider);
  const mkrDec = await mkr.decimals();

  console.log('Per-voter balances (historical Chief MKR → current SKY + residual MKR + contract-check):');
  const results = [];
  for (const v of TOP5_CHIEF_VOTERS) {
    const [skyBal, mkrBal, code] = await Promise.all([
      sky.balanceOf(v.address),
      mkr.balanceOf(v.address),
      provider.getCode(v.address),
    ]);
    const skyHuman = parseFloat(ethers.utils.formatUnits(skyBal, decimals));
    const mkrHuman = parseFloat(ethers.utils.formatUnits(mkrBal, mkrDec));
    const expectedSKY = v.chiefMKR * Number(MIGRATION_RATIO);
    const skyPersistencePct = expectedSKY > 0 ? (skyHuman / expectedSKY) * 100 : 0;
    const mkrPersistencePct = v.chiefMKR > 0 ? (mkrHuman / v.chiefMKR) * 100 : 0;
    const isContract = code && code !== '0x';
    console.log(`  ${v.address} (${isContract ? 'CONTRACT' : 'EOA'})`);
    console.log(`    Historical Chief MKR locked:     ${v.chiefMKR}`);
    console.log(`    Current MKR balance:             ${mkrHuman.toFixed(4)} (${mkrPersistencePct.toFixed(2)}% of historical)`);
    console.log(`    Current SKY balance:             ${skyHuman.toLocaleString()} (expected if migrated: ${expectedSKY.toLocaleString()})`);
    console.log(`    SKY-migration persistence:       ${skyPersistencePct.toFixed(4)}%`);
    results.push({ ...v, isContract, currentMKR: mkrHuman, currentSKY: skyHuman, expectedSKY, skyPersistencePct, mkrPersistencePct });
  }
  console.log('');

  // Summary
  const totalHistorical = TOP5_CHIEF_VOTERS.reduce((a, b) => a + b.chiefMKR, 0);
  const totalExpected = totalHistorical * Number(MIGRATION_RATIO);
  const totalCurrent = results.reduce((a, b) => a + b.currentSKY, 0);
  const agg = (totalCurrent / totalExpected) * 100;
  console.log('AGGREGATE TOP-5:');
  console.log(`  Total historical MKR: ${totalHistorical.toLocaleString()}`);
  console.log(`  Expected migration:   ${totalExpected.toLocaleString()} SKY`);
  console.log(`  Current SKY held:     ${totalCurrent.toLocaleString()}`);
  console.log(`  Aggregate persistence: ${agg.toFixed(2)}%`);
  console.log('');
  console.log('JSON:');
  console.log(JSON.stringify({ topVoters: results, totalHistoricalMKR: totalHistorical, totalExpectedSKY: totalExpected, totalCurrentSKY: totalCurrent, aggregatePersistencePct: agg }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
