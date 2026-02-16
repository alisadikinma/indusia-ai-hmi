/**
 * Document 6: SAT Report Generator
 * Site Acceptance Test — INDUSIA AI Visual Inspection System
 * 
 * Usage: node scripts/docs/generate-sat.js "PT Example Manufacturing" "INDUSIA-2026-001" "Factory Address"
 */

const utils = require('./doc-utils')
const { heading, bodyText, bullet, callout, styledTable, testTable, signOffTable,
  coverPage, revisionHistory, tableOfContents, contentSection, buildAndSave, COMPANY } = utils

const CUSTOMER = process.argv[2] || '[Customer Name]'
const SERIAL = process.argv[3] || '[Machine Serial]'
const SITE_ADDRESS = process.argv[4] || '[Customer Factory Address]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-SAT-001'

// ─── Test Definitions ───
const TESTS = {
  installation: [
    { id: 'SAT-001', description: 'Machine placement and leveling', expected: 'Machine level, stable on factory floor' },
    { id: 'SAT-002', description: 'Power connection (220VAC)', expected: 'Stable power supply, AC ONLINE lamp ON' },
    { id: 'SAT-003', description: 'Compressed air connection (6 bar)', expected: 'Air pressure stable at 6 bar' },
    { id: 'SAT-004', description: 'Network cabling (factory LAN)', expected: 'HMI communicates with AI Backend' },
    { id: 'SAT-005', description: 'Display and operator station ergonomics', expected: 'Comfortable height, no glare, accessible controls' },
    { id: 'SAT-006', description: 'Bridge PC connectivity (if applicable)', expected: 'Dual NIC configured, both networks reachable' },
  ],
  environment: [
    { id: 'SAT-010', description: 'System operates under factory temperature', expected: 'No overheating, stable operation for 1 hour' },
    { id: 'SAT-011', description: 'System operates under factory lighting', expected: 'Camera captures not affected by ambient light' },
    { id: 'SAT-012', description: 'System operates with factory vibration', expected: 'No false triggers, stable image capture' },
    { id: 'SAT-013', description: 'System operates with factory air supply', expected: 'Pneumatics function correctly with factory compressor' },
  ],
  integration: [
    { id: 'SAT-020', description: 'Inspection with actual production PCBs', expected: 'AI processes customer PCBs without errors' },
    { id: 'SAT-021', description: 'AI accuracy on customer board types', expected: 'Defects correctly identified on customer boards' },
    { id: 'SAT-022', description: 'Conveyor speed matches production needs', expected: 'Throughput meets [X] boards/hour target' },
    { id: 'SAT-023', description: 'Cycle time per board', expected: 'Within [X] seconds per board specification' },
    { id: 'SAT-024', description: 'Dual-side inspection (TOP + BOTTOM)', expected: 'Both sides inspected sequentially per board' },
  ],
  productionTrial: [
    { id: 'SAT-030', description: 'Continuous run: [X] boards without error', expected: 'All boards processed, no system crashes' },
    { id: 'SAT-031', description: 'Detection Rate (DDR) \u2265 97%', expected: 'True positives / total defects \u2265 97%' },
    { id: 'SAT-032', description: 'False Call Rate (FCR) < 10%', expected: 'False positives / total calls < 10%' },
    { id: 'SAT-033', description: 'First Pass Yield (FPY) > 95%', expected: 'Good boards / total inspected > 95%' },
    { id: 'SAT-034', description: 'Escape Rate < 1%', expected: 'Missed defects / total defects < 1%' },
    { id: 'SAT-035', description: 'Operator workflow timing', expected: 'GOOD/NG decision within [X] seconds average' },
  ],
  dataIntegrity: [
    { id: 'SAT-040', description: 'Inspection results saved to local DB', expected: 'All results queryable via PostgREST' },
    { id: 'SAT-041', description: 'Work order counters accurate', expected: 'good_qty + ng_qty = completed_qty after trial' },
    { id: 'SAT-042', description: 'Cloud sync with production data', expected: 'All trial data synced to Supabase cloud' },
    { id: 'SAT-043', description: 'False call images uploaded', expected: 'Images in Supabase Storage inspection-images bucket' },
  ],
  operatorValidation: [
    { id: 'SAT-050', description: 'Operator performs full inspection workflow', expected: 'Operator completes 10+ boards without assistance' },
    { id: 'SAT-051', description: 'Operator handles false call submission', expected: 'Reason selected and submitted correctly' },
    { id: 'SAT-052', description: 'Operator manages work orders', expected: 'Can create, activate, and complete WO' },
    { id: 'SAT-053', description: 'Operator uses keyboard shortcuts', expected: 'G/N keys function correctly during inspection' },
  ],
}

async function generate() {
  console.log(`\nGenerating SAT Report for: ${CUSTOMER}`)
  console.log(`Site: ${SITE_ADDRESS}\n`)

  const allTests = Object.values(TESTS).flat()
  const categories = [
    { name: 'Installation Verification', key: 'installation' },
    { name: 'Environmental Tests', key: 'environment' },
    { name: 'Integration Tests', key: 'integration' },
    { name: 'Production Trial', key: 'productionTrial' },
    { name: 'Data Integrity', key: 'dataIntegrity' },
    { name: 'Operator Validation', key: 'operatorValidation' },
  ]

  const children = []

  // Revision History
  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial SAT release'))
  children.push(...tableOfContents())

  // 1. Introduction
  children.push(heading(1, '1. Introduction'))
  children.push(heading(2, '1.1 Purpose'))
  children.push(bodyText(
    'This Site Acceptance Test (SAT) report documents the verification of the INDUSIA AI Visual Inspection System at the customer production site. The SAT confirms that the system operates correctly in the actual production environment after installation.'
  ))
  children.push(heading(2, '1.2 Scope'))
  children.push(bodyText(
    'The SAT covers installation verification, environmental compatibility, integration with production processes, performance benchmarking with actual PCBs, and operator validation. This test builds upon the successful FAT performed prior to shipment.'
  ))
  children.push(heading(2, '1.3 Reference Documents'))
  children.push(bullet('FAT Report (INDUSIA-FAT-001)'))
  children.push(bullet('System Architecture Guide (INDUSIA-DOC-001)'))
  children.push(bullet('Operator Manual (INDUSIA-DOC-002)'))
  children.push(bullet('Maintenance Manual (INDUSIA-DOC-003)'))

  children.push(heading(2, '1.4 Site Information'))
  children.push(styledTable(
    ['Item', 'Detail'],
    [
      ['Customer', CUSTOMER],
      ['Site Address', SITE_ADDRESS],
      ['Machine Serial', SERIAL],
      ['FAT Date', '[FAT Date]'],
      ['Installation Date', '[Install Date]'],
      ['SAT Date', DATE],
    ],
    [3000, 6026]
  ))

  // 2. Installation Verification
  children.push(heading(1, '2. Installation Verification'))
  children.push(heading(2, '2.1 Physical Installation Checklist'))
  children.push(styledTable(
    ['Check Item', 'Status', 'Notes'],
    [
      ['Machine placed on level surface', '', ''],
      ['Power cable connected (220VAC)', '', ''],
      ['Air compressor connected (6 bar)', '', ''],
      ['Network cables connected', '', ''],
      ['Display at ergonomic height', '', ''],
      ['Operator station accessible', '', ''],
      ['Emergency stop accessible', '', ''],
      ['Adequate lighting (1000-2000 lux)', '', ''],
      ['Ventilation adequate', '', ''],
    ],
    [4000, 2000, 3026]
  ))

  children.push(heading(2, '2.2 Software Configuration'))
  children.push(styledTable(
    ['Configuration Item', 'Value', 'Verified'],
    [
      ['Database initialized', 'Yes/No', ''],
      ['Customer master data loaded', 'Yes/No', ''],
      ['AI model assigned to line(s)', '[Model Name]', ''],
      ['User accounts created', '[Count] users', ''],
      ['Cloud sync configured', 'Yes/No/N/A', ''],
      ['Environment variables set', 'Yes/No', ''],
    ],
    [3500, 3000, 2526]
  ))

  // 3. Functional Tests
  children.push(heading(1, '3. Functional Test Results'))
  children.push(callout('NOTE', 'Actual Result and Result columns are completed by the installation engineer during SAT execution.'))

  categories.forEach((cat, idx) => {
    children.push(heading(2, `3.${idx + 1} ${cat.name}`))
    children.push(testTable(TESTS[cat.key]))
  })

  // 4. Performance Metrics
  children.push(heading(1, '4. Performance Metrics'))
  children.push(bodyText('Measured during the production trial run:'))
  children.push(styledTable(
    ['Metric', 'Target', 'Actual', 'PASS/FAIL'],
    [
      ['Detection Rate (DDR)', '\u2265 97%', '', ''],
      ['False Call Rate (FCR)', '< 10%', '', ''],
      ['First Pass Yield (FPY)', '> 95%', '', ''],
      ['Escape Rate', '< 1%', '', ''],
      ['Throughput', '[X] boards/hour', '', ''],
      ['Avg. Cycle Time', '[X] sec/board', '', ''],
      ['System Uptime', '> 99%', '', ''],
    ],
    [2500, 2000, 2200, 2326]
  ))

  // 5. AI Accuracy Stabilization Commitment
  children.push(heading(1, '5. AI Model Accuracy and Stabilization Commitment'))
  children.push(bodyText(
    'The INDUSIA AI system employs a self-improving deep learning architecture designed to achieve optimal detection accuracy through continuous learning from production data. The initial AI model has been trained using ' + CUSTOMER + '\'s provided PCB reference samples. Due to limited sample availability — particularly for PCB models 2, 3, and 4 where only one (1) unit per model was provided — the initial training dataset consists exclusively of GOOD (pass) reference images with no NG (defective) samples available for training.'
  ))
  children.push(bodyText(
    COMPANY.name + ' is fully committed to ensuring ' + CUSTOMER + ' achieves the targeted inspection performance through a continuous AI improvement cycle and on-site technical support.'
  ))

  children.push(heading(2, '5.1 AI Improvement Cycle'))
  children.push(bodyText('The AI model improves through a continuous back-and-forth cycle between the production floor and ' + COMPANY.name + '\'s AI engineering team:'))
  children.push(bodyText(' '))
  children.push(styledTable(
    ['Step', 'Actor', 'Action'],
    [
      ['1', 'AI System', 'Inspects PCB automatically and flags boards as PASS or NG'],
      ['2', 'Operator', 'Monitors AI results — reviews NG decisions to verify accuracy'],
      ['3', 'Operator', 'If AI NG is incorrect (false call): submits override with reason and evidence photo'],
      ['4', 'Manager', 'Reviews false call in Override Queue — approves if operator is correct'],
      ['5', 'Manager', 'Triggers Cloud Sync — approved false call data uploaded to ' + COMPANY.name + '\'s database'],
      ['6', COMPANY.name, 'AI engineering team retrains the model using false call data'],
      ['7', COMPANY.name, 'Deploys updated AI model back to production line via OTA update'],
      ['8', 'AI System', 'Updated model no longer makes the same false call — accuracy improves'],
    ],
    [600, 1800, 6626]
  ))
  children.push(bodyText(' '))
  children.push(bodyText('This cycle repeats continuously. Each iteration makes the AI smarter — reducing false call rates and improving detection precision. The process is projected to reach stability within 90 days of production go-live.'))
  children.push(bodyText(' '))
  children.push(bodyText('On-Site Technical Team Deployment:', { bold: true }))
  children.push(bullet(COMPANY.name + ' will station a dedicated technical team at ' + CUSTOMER + '\'s production line during the initial go-live period to accelerate AI improvement'))
  children.push(bullet('The team will collect real NG samples directly from the production floor and perform on-site AI model retraining'))
  children.push(bullet('Detection parameters will be fine-tuned to optimize accuracy for ' + CUSTOMER + '\'s specific PCB characteristics'))
  children.push(bullet('OTA (Over-the-Air) model deployment allows seamless AI updates without production downtime'))

  children.push(heading(2, '5.2 Projected Stabilization Timeline'))
  children.push(styledTable(
    ['Phase', 'Timeline', 'Expected Outcome', COMPANY.name + ' Support'],
    [
      ['Go-Live Baseline', 'Week 1–2', 'System operational with reference-based detection. Operators familiarize with workflow. False call data collection begins.', 'On-site team at production line collecting NG samples and monitoring system performance.'],
      ['Active Data Collection', 'Week 3–6', 'First model retraining with accumulated NG samples. Measurable false call rate reduction.', 'On-site AI retraining and model optimization. Regular performance reporting.'],
      ['Accuracy Stabilization', 'Month 2–3', 'AI model reaches maturity. Detection accuracy exceeds 95%. False call rate drops below target threshold.', 'Continued on-site support. Performance validation and acceptance review.'],
      ['Ongoing Operation', 'Month 3+', 'Steady-state operation. Periodic model refinements. New defect patterns automatically captured via false call workflow.', 'Remote monitoring and periodic model improvement via OTA updates.'],
    ],
    [1500, 1100, 3200, 3226]
  ))
  children.push(callout('NOTE', 'The AI accuracy stabilization timeline above represents ' + COMPANY.name + '\'s commitment to ensuring ' + CUSTOMER + ' achieves optimal inspection performance. This stabilization support is an integral part of the system delivery and reflects the natural maturation process of the AI model as it learns from real production data. Upon completion of the stabilization period, ' + COMPANY.name + ' will continue to provide ongoing remote support, periodic model improvements, and OTA software updates as part of our long-term service commitment to ' + CUSTOMER + '.'))

  // 6. Test Summary
  children.push(heading(1, '6. Test Summary'))
  children.push(styledTable(
    ['Category', 'Total', 'Passed', 'Failed', 'N/A'],
    categories.map(c => [c.name, String(TESTS[c.key].length), '', '', '']),
    [2500, 1500, 1500, 1500, 2026]
  ))

  // 7. Punch List
  children.push(heading(1, '7. Punch List / Outstanding Items'))
  children.push(bodyText('Items requiring resolution after SAT:'))
  children.push(styledTable(
    ['#', 'Description', 'Priority', 'Responsible', 'Due Date', 'Status'],
    [
      ['1', '', '', '', '', ''],
      ['2', '', '', '', '', ''],
      ['3', '', '', '', '', ''],
    ],
    [500, 2500, 1200, 1500, 1300, 2026]
  ))

  // 8. Training Confirmation
  children.push(heading(1, '8. Training Confirmation'))
  children.push(bodyText('The following personnel have been trained on the INDUSIA AI system:'))
  children.push(styledTable(
    ['Name', 'Role', 'Training Date', 'Topics', 'Trainer'],
    [
      ['', 'Operator', '', 'Machine operation, GOOD/NG workflow, false call', ''],
      ['', 'Operator', '', 'Machine operation, GOOD/NG workflow, false call', ''],
      ['', 'Engineer', '', 'Master data, work orders, user management', ''],
      ['', 'Technician', '', 'Maintenance procedures, troubleshooting', ''],
    ],
    [1800, 1200, 1400, 2400, 2226]
  ))

  // 9. Warranty
  children.push(heading(1, '9. Warranty and Support'))
  children.push(styledTable(
    ['Item', 'Detail'],
    [
      ['Provider', COMPANY.name],
      ['Provider Address', COMPANY.address],
      ['Sales Manager', COMPANY.salesManager],
      ['Project Manager', COMPANY.projectManager],
      ['Warranty Start Date', '[Date]'],
      ['Warranty Period', '[X] months'],
      ['Support Contact', '[Email / Phone]'],
      ['Support Hours', '[Business Hours]'],
      ['Escalation Contact', '[Name / Phone]'],
      ['Remote Support', 'Available via [method]'],
    ],
    [3000, 6026]
  ))

  // 10. Conclusion
  children.push(heading(1, '10. Conclusion and Recommendation'))
  children.push(bodyText('Based on the site acceptance test results:'))
  children.push(bodyText(' '))
  children.push(bodyText('\u2610  System ACCEPTED for production use'))
  children.push(bodyText('\u2610  System ACCEPTED with punch list items (to be resolved by [date])'))
  children.push(bodyText('\u2610  System REJECTED (critical failures identified)'))
  children.push(bodyText(' '))
  children.push(bodyText('Additional remarks:'))
  children.push(bodyText('_____________________________________________________________________________'))

  // 11. Sign-Off
  children.push(heading(1, '11. Sign-Off'))
  children.push(bodyText('By signing below, all parties confirm the SAT results and acceptance decision.'))
  children.push(signOffTable([
    { org: COMPANY.name, role: 'Installation Engineer' },
    { org: COMPANY.name, role: 'Project Manager' },
    { org: CUSTOMER, role: 'Production Manager' },
    { org: CUSTOMER, role: 'Quality Manager' },
    { org: CUSTOMER, role: 'IT Manager' },
  ]))

  // Build
  const sections = [
    coverPage('Site Acceptance Test (SAT) Report', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('SAT Report', children),
  ]

  await buildAndSave(sections, '06_SAT_Report.docx')
  console.log(`\n📊 Test cases: ${allTests.length} across ${categories.length} categories`)
}

generate().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
