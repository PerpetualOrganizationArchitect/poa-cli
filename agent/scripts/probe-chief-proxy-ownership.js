const { ethers } = require('ethers');
const provider = new ethers.providers.StaticJsonRpcProvider({ url: 'https://ethereum.publicnode.com', timeout: 30000 }, { chainId: 1, name: 'mainnet' });
const PROXY_ABI = [
  'function cold() view returns (address)',
  'function hot() view returns (address)',
  'function owner() view returns (address)',
];
const TOP5 = [
  '0xa346c2eea05bb32c986ff755b2f19d2f0ba8d14c',
  '0x5fac03e07447c1a3f4ad9a5f778f23c9e1fc4255',
  '0xde08aef2b221274231b3547491ec8f0fc80917e1',
  '0x69b576a7e193a15a570ee5bb2149deb3f03537a2',
  '0xfe61acc408b63a5a03507a224398fa1fe8143f28',
];
(async () => {
  for (const addr of TOP5) {
    const c = new ethers.Contract(addr, PROXY_ABI, provider);
    const result = { address: addr };
    try { result.cold = await c.cold(); } catch { result.cold = null; }
    try { result.hot = await c.hot(); } catch { result.hot = null; }
    try { result.owner = await c.owner(); } catch { result.owner = null; }
    // Also get contract bytecode size for rough classification
    const code = await provider.getCode(addr);
    result.bytecodeSize = (code.length - 2) / 2;
    console.log(JSON.stringify(result));
  }
})();
