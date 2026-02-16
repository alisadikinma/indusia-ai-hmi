/**
 * INDUSIA Document Generator — Orchestrator
 *
 * Generates all 6 delivery documents or a specific subset.
 *
 * Usage:
 *   node scripts/docs/generate-all.js "Customer Name" "Serial" "Site Address"   → all 6 docs
 *   node scripts/docs/generate-all.js "Customer Name" "Serial" "Site Address" 5 → FAT only
 *   node scripts/docs/generate-all.js "Customer Name" "Serial" "Site Address" 5 6 → FAT + SAT
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const CUSTOMER = process.argv[2] || '[Customer Name]'
const SERIAL = process.argv[3] || 'INDUSIA-2026-001'
const SITE_ADDRESS = process.argv[4] || '[Customer Factory Address]'

// Parse which docs to generate (remaining numeric args)
let docNums = process.argv.slice(5).filter(a => !isNaN(a)).map(Number)
if (docNums.length === 0) docNums = [1, 2, 3, 4, 5, 6]

const SCRIPTS_DIR = __dirname
const OUTPUT_DIR = path.resolve(SCRIPTS_DIR, '..', '..', 'docs', 'FAT_SAT', 'deliverables')

const DOCS = {
  1: { name: 'System Overview Guide', script: 'generate-architecture.js', args: [CUSTOMER] },
  2: { name: 'Operator Manual', script: 'generate-operator-manual.js', args: [CUSTOMER] },
  3: { name: 'Maintenance Manual', script: 'generate-maintenance.js', args: [CUSTOMER] },
  4: { name: 'Troubleshooting Guide', script: 'generate-troubleshooting.js', args: [CUSTOMER] },
  5: { name: 'FAT Report', script: 'generate-fat.js', args: [CUSTOMER, SERIAL] },
  6: { name: 'SAT Report', script: 'generate-sat.js', args: [CUSTOMER, SERIAL, SITE_ADDRESS] },
}

// Ensure output dir
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

console.log('╔══════════════════════════════════════════════════════════╗')
console.log('║     INDUSIA AI — Document Generator                     ║')
console.log('╚══════════════════════════════════════════════════════════╝')
console.log(`  Customer:  ${CUSTOMER}`)
console.log(`  Serial:    ${SERIAL}`)
console.log(`  Site:      ${SITE_ADDRESS}`)
console.log(`  Documents: ${docNums.map(n => `${n}. ${DOCS[n]?.name}`).join(', ')}`)
console.log(`  Output:    ${OUTPUT_DIR}`)
console.log('')

let success = 0
let failed = 0

for (const num of docNums) {
  const doc = DOCS[num]
  if (!doc) {
    console.log(`⚠️  Unknown document number: ${num}`)
    continue
  }

  const scriptPath = path.join(SCRIPTS_DIR, doc.script)
  if (!fs.existsSync(scriptPath)) {
    console.log(`⏭️  Skipping ${num}. ${doc.name} — generator not yet implemented (${doc.script})`)
    failed++
    continue
  }

  console.log(`\n──── ${num}. ${doc.name} ────`)
  try {
    const argsStr = doc.args.map(a => `"${a}"`).join(' ')
    execSync(`node "${scriptPath}" ${argsStr}`, {
      stdio: 'inherit',
      cwd: path.resolve(SCRIPTS_DIR, '..', '..'),
    })
    success++
  } catch (err) {
    console.error(`❌ Failed to generate: ${doc.name}`)
    console.error(err.message)
    failed++
  }
}

console.log('\n══════════════════════════════════════════════════════════')
console.log(`✅ Generated: ${success}  ⏭️ Skipped/Failed: ${failed}  Total: ${docNums.length}`)
console.log('══════════════════════════════════════════════════════════')

// List output files
if (fs.existsSync(OUTPUT_DIR)) {
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.docx'))
  if (files.length > 0) {
    console.log('\nOutput files:')
    files.forEach(f => {
      const stats = fs.statSync(path.join(OUTPUT_DIR, f))
      console.log(`  📄 ${f} (${Math.round(stats.size / 1024)} KB)`)
    })
  }
}
