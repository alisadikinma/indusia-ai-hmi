/**
 * Password Hash Generator
 * Run: node scripts/generatePasswordHashes.js
 * 
 * Use this to generate bcrypt hashes for seed data
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const passwords = [
  { user: 'admin', plain: 'admin123' },
  { user: 'manager', plain: 'manager123' },
  { user: 'operator', plain: 'operator123' },
  { user: 'engineer', plain: 'engineer123' },
];

async function generateHashes() {
  console.log('Generating bcrypt hashes (cost factor: ' + SALT_ROUNDS + '):\n');
  
  for (const p of passwords) {
    const hash = await bcrypt.hash(p.plain, SALT_ROUNDS);
    console.log(`${p.user}:`);
    console.log(`  Plain: ${p.plain}`);
    console.log(`  Hash:  ${hash}`);
    console.log('');
  }
  
  console.log('\n-- SQL Format for seed data:');
  for (const p of passwords) {
    const hash = await bcrypt.hash(p.plain, SALT_ROUNDS);
    console.log(`-- ${p.user}: '${hash}'`);
  }
}

generateHashes();
