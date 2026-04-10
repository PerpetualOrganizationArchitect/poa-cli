#!/usr/bin/env npx ts-node
/**
 * Agent Setup Script
 * Generates a new agent wallet and creates the brain directory structure.
 * Usage: npx ts-node scripts/setup-agent.ts [--org Argus] [--chain 100] [--username my_agent]
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const orgName = getArg('org', 'Argus');
const chainId = getArg('chain', '100');
const username = getArg('username', '');

const AGENT_HOME = path.join(process.env.HOME || '~', '.pop-agent');
const BRAIN_DIR = path.join(AGENT_HOME, 'brain');
const IDENTITY_DIR = path.join(BRAIN_DIR, 'Identity');
const MEMORY_DIR = path.join(BRAIN_DIR, 'Memory');

// Check if already set up
if (fs.existsSync(path.join(AGENT_HOME, '.env'))) {
  console.error(`\n  ✗ Agent already set up at ${AGENT_HOME}`);
  console.error('    Remove ~/.pop-agent/.env to start fresh.\n');
  process.exit(1);
}

// Generate wallet
const wallet = ethers.Wallet.createRandom();
console.log('\n  Agent Setup');
console.log('  ' + '─'.repeat(50));
console.log(`  Wallet:  ${wallet.address}`);
console.log(`  Org:     ${orgName}`);
console.log(`  Chain:   ${chainId}`);
if (username) console.log(`  Username: ${username}`);
console.log('');

// Create directory structure
for (const dir of [AGENT_HOME, BRAIN_DIR, IDENTITY_DIR, MEMORY_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Write .env
fs.writeFileSync(path.join(AGENT_HOME, '.env'), [
  `POP_PRIVATE_KEY=${wallet.privateKey}`,
  `POP_DEFAULT_ORG=${orgName}`,
  `POP_DEFAULT_CHAIN=${chainId}`,
  '',
].join('\n'));

// Write who-i-am.md
fs.writeFileSync(path.join(IDENTITY_DIR, 'who-i-am.md'), `# Agent Identity

## Wallet
- **Address**: ${wallet.address}
- **Chain**: ${chainId}

## Organization
- **Org Name**: ${orgName}
- **Username**: ${username || '(register with pop user register --username <name>)'}

## Hats (Roles)
- (will be populated after vouching and joining)

## Operator
- **Human operator**: (set this)
- **Escalation method**: Log to ~/.pop-agent/brain/Memory/escalations.md

## Constraints
- Never hold treasury funds or approve financial transactions autonomously
- Never modify heuristics without operator approval
- Always log reasoning before acting
- If confidence is LOW, escalate instead of acting
`);

// Write goals.md
fs.writeFileSync(path.join(IDENTITY_DIR, 'goals.md'), `# Agent Goals

## Primary Goals
1. Never miss a vote
2. Monitor org health
3. Complete assigned tasks
4. Fix what's broken

## Current Focus
- Register username and join the org
- Complete the governance education module
- Start participating in governance
`);

// Write capabilities.md
fs.writeFileSync(path.join(IDENTITY_DIR, 'capabilities.md'), `# Agent Capabilities

## Getting Started
- Register username: \`pop user register --username <name>\`
- Join org: \`pop user join\`
- Check profile: \`pop user profile --json\`
- View org status: \`pop org status\`

## Not Yet Learned
- Voting on proposals
- Task management
- Self-healing patterns
- Content creation

## Want to Learn
- Everything — this is a fresh agent
`);

// Write empty memory files
const memoryFiles: Record<string, string> = {
  'org-state.md': '# Org State\n',
  'task-log.md': '# Heartbeat Log\n',
  'decisions.md': '# Decision Log\n',
  'corrections.md': '# Corrections\n',
  'escalations.md': '# Escalations\n',
};

for (const [filename, content] of Object.entries(memoryFiles)) {
  fs.writeFileSync(path.join(MEMORY_DIR, filename), content);
}

console.log('  Created:');
console.log(`    ${AGENT_HOME}/.env`);
console.log(`    ${IDENTITY_DIR}/who-i-am.md`);
console.log(`    ${IDENTITY_DIR}/goals.md`);
console.log(`    ${IDENTITY_DIR}/capabilities.md`);
console.log(`    ${MEMORY_DIR}/ (5 memory files)`);
console.log('');
console.log('  Next steps:');
console.log(`    1. Fund wallet ${wallet.address} with xDAI for gas`);
console.log('    2. Symlink env:  ln -sf ~/.pop-agent/.env .env');
console.log(`    3. Register:     pop user register --username ${username || '<choose-a-name>'}`);
console.log('    4. Ask an existing member to vouch:');
console.log(`         pop vouch for --address ${wallet.address} --hat <role-hat-id>`);
console.log('    5. Join org:     pop user join');
console.log('    6. Start heartbeat: /loop 15m /heartbeat');
console.log('');
console.log('  ⚠  Save the private key from ~/.pop-agent/.env — it cannot be recovered.');
console.log('');
