/**
 * Document 5: FAT Report Generator
 * Factory Acceptance Test — INDUSIA AI Visual Inspection System
 * 
 * Usage: node scripts/docs/generate-fat.js "PT Example Manufacturing" "INDUSIA-2026-001"
 */

const utils = require('./doc-utils')
const { heading, bodyText, bullet, callout, styledTable, testTable, signOffTable,
  coverPage, revisionHistory, tableOfContents, contentSection, buildAndSave, CONTENT_WIDTH, COMPANY } = utils

// ─── Config ───
const CUSTOMER = process.argv[2] || '[Customer Name]'
const SERIAL = process.argv[3] || '[Machine Serial]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-FAT-001'

// ─── Test Definitions ───
const TESTS = {
  powerOn: [
    { id: 'FAT-001', description: 'AC Power verification', expected: 'AC ONLINE lamp is ON' },
    { id: 'FAT-002', description: 'RCCB/MCB activation', expected: 'All breakers in ON position' },
    { id: 'FAT-003', description: 'All indicator lamps functional', expected: 'Pass/Fail/Bench/Box/Cam/UV lamps respond' },
    { id: 'FAT-004', description: 'Air pressure verification', expected: 'Filter regulator shows 6 bar, no leaks' },
    { id: 'FAT-005', description: 'Emergency stop function', expected: 'E-Stop halts all operations immediately' },
  ],
  hardware: [
    { id: 'FAT-010', description: 'Top camera capture test', expected: 'Clear image captured from top camera' },
    { id: 'FAT-011', description: 'Bottom camera capture test', expected: 'Clear image captured from bottom camera' },
    { id: 'FAT-012', description: 'PLC communication established', expected: 'PLC status shows ONLINE in HMI' },
    { id: 'FAT-013', description: 'Conveyor operation (forward)', expected: 'PCB pallet moves smoothly to inspection position' },
    { id: 'FAT-014', description: 'Conveyor operation (return)', expected: 'PCB pallet returns to load position' },
    { id: 'FAT-015', description: 'Reject mechanism actuation', expected: 'Cylinder actuates and rejects board on NG signal' },
    { id: 'FAT-016', description: 'PCB pallet locking mechanism', expected: 'Pallet locks securely, no movement during inspection' },
    { id: 'FAT-017', description: 'Dual START button interlock', expected: 'Both buttons must be pressed simultaneously' },
  ],
  authRBAC: [
    { id: 'FAT-020', description: 'Login with Super Admin credentials', expected: 'Successful login, full menu access' },
    { id: 'FAT-021', description: 'Login with Operator credentials', expected: 'Successful login, operator menu only' },
    { id: 'FAT-022', description: 'Login with Manager credentials', expected: 'Successful login, manager menu access' },
    { id: 'FAT-023', description: 'Login with Engineer credentials', expected: 'Successful login, engineering menu access' },
    { id: 'FAT-024', description: 'Login with invalid credentials', expected: 'Login rejected with error message' },
    { id: 'FAT-025', description: 'Logout function', expected: 'Session terminated, redirected to login page' },
    { id: 'FAT-026', description: 'Role-based menu restriction', expected: 'Unauthorized menus are hidden/inaccessible' },
  ],
  masterData: [
    { id: 'FAT-030', description: 'Customer — Create, Read, Update', expected: 'Customer record created and editable' },
    { id: 'FAT-031', description: 'Section — Create, Read, Update', expected: 'Section linked to customer correctly' },
    { id: 'FAT-032', description: 'Production Line — Create, Read, Update', expected: 'Line linked to section, AI backend URL set' },
    { id: 'FAT-033', description: 'Board Model — Create, Read, Update', expected: 'Board model with part number created' },
    { id: 'FAT-034', description: 'False Call Reason — Create, Read, Update', expected: 'Reason codes available for operator selection' },
  ],
  workOrder: [
    { id: 'FAT-040', description: 'Create Work Order', expected: 'WO created with correct board, line, lot size' },
    { id: 'FAT-041', description: 'Activate Work Order', expected: 'WO status changes to Active' },
    { id: 'FAT-042', description: 'Work Order counters — initial state', expected: 'Completed=0, Good=0, NG=0, False Call=0' },
    { id: 'FAT-043', description: 'Complete Work Order', expected: 'WO status changes to Completed' },
    { id: 'FAT-044', description: 'Hold/Resume Work Order', expected: 'WO can be paused and resumed' },
  ],
  liveInspection: [
    { id: 'FAT-050', description: 'Select production line for inspection', expected: 'Line list displayed, selection works' },
    { id: 'FAT-051', description: 'Select AI model', expected: 'Available models for line shown' },
    { id: 'FAT-052', description: 'SSE connection established', expected: 'Real-time connection to AI Backend confirmed' },
    { id: 'FAT-053', description: 'AI inference produces result', expected: 'PASS/FAIL decision with confidence score displayed' },
    { id: 'FAT-054', description: 'Bounding box overlay on defects', expected: 'Defect locations highlighted on board image' },
    { id: 'FAT-055', description: 'GOOD button — board passes', expected: 'Board marked as GOOD, counter increments' },
    { id: 'FAT-056', description: 'NG button — board rejected', expected: 'Board marked as NG, counter increments, PLC rejects' },
    { id: 'FAT-057', description: 'False call detection (AI=FAIL, Operator=GOOD)', expected: 'False call auto-detected, reason dialog shown' },
    { id: 'FAT-058', description: 'False call detection (AI=PASS, Operator=NG)', expected: 'False call auto-detected, reason dialog shown' },
    { id: 'FAT-059', description: 'False call reason submission', expected: 'Reason saved to database, false call counter increments' },
    { id: 'FAT-060', description: 'Keyboard shortcut G (GOOD)', expected: 'Same as clicking GOOD button' },
    { id: 'FAT-061', description: 'Keyboard shortcut N (NG)', expected: 'Same as clicking NG button' },
    { id: 'FAT-062', description: 'PLC receives operator decision', expected: 'Conveyor acts on GOOD/NG signal correctly' },
    { id: 'FAT-063', description: 'Board sequence counter accuracy', expected: 'Counter matches actual boards inspected' },
  ],
  management: [
    { id: 'FAT-070', description: 'Override queue displays pending items', expected: 'Manager sees list of operator overrides' },
    { id: 'FAT-071', description: 'Override approve action', expected: 'Override approved, record updated' },
    { id: 'FAT-072', description: 'Override reject action', expected: 'Override rejected, record updated' },
    { id: 'FAT-073', description: 'User management — Add user', expected: 'New user created with assigned role' },
    { id: 'FAT-074', description: 'User management — Edit user', expected: 'User details updated' },
    { id: 'FAT-075', description: 'User management — Deactivate user', expected: 'User status set to inactive, cannot login' },
    { id: 'FAT-076', description: 'Role management — Create/Edit role', expected: 'Custom role with permissions created' },
    { id: 'FAT-077', description: 'Permission matrix — Grant/Revoke', expected: 'Permission changes reflected immediately' },
  ],
  cloudSync: [
    { id: 'FAT-080', description: 'Manual sync trigger', expected: 'Sync process starts, progress modal shown' },
    { id: 'FAT-081', description: 'Sync completes without error', expected: 'All records synced to cloud, success message' },
    { id: 'FAT-082', description: 'Sync history recorded', expected: 'Sync event with timestamp and record count logged' },
    { id: 'FAT-083', description: 'Sync detail view', expected: 'Detailed breakdown of synced tables/records' },
    { id: 'FAT-084', description: 'False call images uploaded to cloud storage', expected: 'Images available in Supabase Storage bucket' },
    { id: 'FAT-085', description: 'Sync lock prevents concurrent sync', expected: 'Second sync attempt blocked while first is running' },
  ],
  safety: [
    { id: 'FAT-090', description: 'Emergency stop halts all operations', expected: 'Machine stops immediately, HMI shows alert' },
    { id: 'FAT-091', description: 'Power loss recovery', expected: 'System resumes correctly after power restored' },
    { id: 'FAT-092', description: 'Network disconnect graceful handling', expected: 'HMI shows offline indicator, no data loss' },
    { id: 'FAT-093', description: 'AI Backend disconnect recovery', expected: 'SSE reconnects automatically (max 10 retries)' },
    { id: 'FAT-094', description: 'Database disconnect recovery', expected: 'Operations resume when DB connection restored' },
  ],
}

// ─── Build Document ───
async function generate() {
  console.log(`\nGenerating FAT Report for: ${CUSTOMER}`)
  console.log(`Machine Serial: ${SERIAL}\n`)

  const allTests = Object.values(TESTS).flat()
  const categories = [
    { name: 'Power-On Sequence', key: 'powerOn' },
    { name: 'Hardware', key: 'hardware' },
    { name: 'Authentication & RBAC', key: 'authRBAC' },
    { name: 'Master Data', key: 'masterData' },
    { name: 'Work Order', key: 'workOrder' },
    { name: 'Live Inspection', key: 'liveInspection' },
    { name: 'Management', key: 'management' },
    { name: 'Cloud Sync', key: 'cloudSync' },
    { name: 'Safety', key: 'safety' },
  ]

  // Build content children
  const children = []

  // ── Revision History ──
  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial FAT release'))
  children.push(...tableOfContents())

  // ── 1. Introduction ──
  children.push(heading(1, '1. Introduction'))
  children.push(heading(2, '1.1 Purpose'))
  children.push(bodyText(
    'This Factory Acceptance Test (FAT) report documents the systematic verification of the INDUSIA AI Visual Inspection System prior to shipment to the customer site. All functional, hardware, and software tests are performed at the INDUSIA AI workshop to ensure the system meets the agreed specifications.'
  ))
  children.push(heading(2, '1.2 Scope'))
  children.push(bodyText(
    'The FAT covers hardware functionality, software features, AI inspection capabilities, operator workflows, data management, cloud synchronization, and safety systems. Tests are conducted with test PCB samples under controlled conditions.'
  ))

  children.push(heading(2, '1.3 AI Model Sample Availability and Accuracy Roadmap'))
  children.push(bodyText(
    'It is important to note that the AI model deployed for this FAT has been trained using the PCB reference samples provided by ' + CUSTOMER + '. Due to limited sample availability — particularly for PCB models 2, 3, and 4 where only one (1) unit per model was provided — the initial training dataset consists exclusively of GOOD (pass) reference images with no NG (defective) samples available for training.'
  ))
  children.push(bodyText(
    'The INDUSIA AI system is architected with a self-improving deep learning pipeline that continuously improves through a back-and-forth cycle between the production floor and ' + COMPANY.name + '\'s AI engineering team:'
  ))
  children.push(bodyText(' '))
  children.push(bodyText('The AI Improvement Cycle:', { bold: true }))
  children.push(bullet('AI inspects boards automatically → Operator monitors results and reviews NG decisions'))
  children.push(bullet('If AI\'s NG decision is incorrect → Operator submits false call with reason and evidence'))
  children.push(bullet('Manager reviews and approves the false call → triggers Cloud Sync'))
  children.push(bullet('Approved false call data is uploaded to ' + COMPANY.name + '\'s database'))
  children.push(bullet(COMPANY.name + ' retrains the AI model using the false call data'))
  children.push(bullet('Updated model is deployed back to production line via OTA update'))
  children.push(bullet('AI no longer makes the same false call → cycle repeats for new patterns'))
  children.push(bodyText(' '))
  children.push(bodyText(
    'In addition, ' + COMPANY.name + ' will deploy a dedicated technical team on-site at ' + CUSTOMER + '\'s production line during the initial go-live period to collect real NG samples and accelerate the AI retraining cycle. Based on our deployment methodology, we project the AI model will reach operational stability within 90 days of production go-live through this continuous improvement process.'
  ))
  children.push(callout('NOTE', 'AI model accuracy targets in this FAT are evaluated against the available training data. Performance metrics will be re-evaluated during SAT and throughout the post-deployment stabilization period. The stabilization support is an integral part of the system delivery and reflects the AI model\'s natural maturation process as it learns from real production data. ' + COMPANY.name + ' will continue to provide ongoing remote support and periodic model improvements beyond the stabilization period.'))

  children.push(heading(2, '1.4 Reference Documents'))
  children.push(bullet('System Architecture Guide (INDUSIA-DOC-001)'))
  children.push(bullet('Operator Manual (INDUSIA-DOC-002)'))
  children.push(bullet('Maintenance Manual (INDUSIA-DOC-003)'))
  children.push(bullet('Customer Requirements Specification'))

  // ── 2. Test Configuration ──
  children.push(heading(1, '2. Test Configuration'))
  children.push(heading(2, '2.1 Hardware Configuration'))
  children.push(styledTable(
    ['Component', 'Model/Spec', 'Serial No.', 'Status'],
    [
      ['Edge Device (CPU)', 'Geekom IT13 — i9-13900HK, 64GB RAM, 2TB SSD', SERIAL, ''],
      ['Display (Touchscreen)', 'Customer-supplied touchscreen', '-', ''],
      ['Camera', 'HIKROBOT MV-CS200-10GC (20.2MP, 10GigE)', '[Serial]', ''],
      ['Lens', 'MVL-KF1624M-25MP (25MP-rated)', '-', ''],
      ['PLC', 'Omron CP1L-L20DT-D + CP1W CIF01 serial', '[Serial]', ''],
      ['UV Lamp', 'UV-A T8 BLB 15W 365nm (×2)', '-', ''],
      ['Camera Lamp', 'LED with dimmer (calibrated 1318 lux)', '-', ''],
      ['Pneumatic Cylinder', 'SMC CM2B20-200Z', '-', ''],
      ['Rotary Table', 'SMC MSQB-10A (180° indexing)', '-', ''],
      ['Filter Regulator', 'SMC with pressure gauge (6 bar)', '-', ''],
      ['Power Supply', 'Schneider ABL2REM24065K (24VDC 5A)', '-', ''],
      ['RCCB', 'Schneider A9R71225 (2P 25A 30mA)', '-', ''],
      ['MCB 1–3', 'Schneider iK60N (2A/4A C-curve)', '-', ''],
    ],
    [2000, 2800, 2200, 2026]
  ))

  children.push(heading(2, '2.2 Software Configuration'))
  children.push(styledTable(
    ['Software', 'Version', 'Status'],
    [
      ['Next.js HMI', '13.5.x', ''],
      ['AI Backend (Auto Inspect Edge)', '[Version]', ''],
      ['PostgreSQL', '16.x', ''],
      ['PostgREST', '12.x', ''],
      ['AI Model (per PCB)', '[Model Name v.X]', ''],
      ['Operating System', 'Windows 11', ''],
    ],
    [3500, 3000, 2526]
  ))

  children.push(heading(2, '2.3 Network Configuration'))
  children.push(styledTable(
    ['Service', 'IP Address', 'Port', 'Status'],
    [
      ['Next.js HMI', 'localhost', '3000', ''],
      ['PostgREST API', 'localhost', '3001', ''],
      ['PostgreSQL', 'localhost', '5432', ''],
      ['AI Backend', 'localhost', '8002', ''],
      ['AI Backend SSE', 'localhost', '8002', ''],
    ],
    [2200, 2400, 1500, 2926]
  ))

  // ── 3. Functional Test Results ──
  children.push(heading(1, '3. Functional Test Results'))
  children.push(bodyText(
    'Each test case includes the test ID, description, expected result, actual result (to be filled during test), and PASS/FAIL verdict. Leave Actual Result and Result columns blank until test execution.'
  ))
  children.push(callout('NOTE', 'Actual Result and Result columns are completed by the test engineer during FAT execution.'))

  categories.forEach((cat, idx) => {
    children.push(heading(2, `3.${idx + 1} ${cat.name} Tests`))
    children.push(testTable(TESTS[cat.key]))
  })

  // ── 4. Test Summary ──
  children.push(heading(1, '4. Test Summary'))
  children.push(styledTable(
    ['Category', 'Total Tests', 'Passed', 'Failed', 'N/A'],
    categories.map(cat => [cat.name, String(TESTS[cat.key].length), '', '', '']),
    [2500, 1500, 1500, 1500, 2026]
  ))
  children.push(bodyText(' ')) // spacer
  children.push(styledTable(
    ['', 'Count'],
    [
      ['Total Test Cases', String(allTests.length)],
      ['Total Passed', ''],
      ['Total Failed', ''],
      ['Total N/A', ''],
      ['Pass Rate', ''],
    ],
    [4513, 4513]
  ))

  // ── 5. Non-Conformance Report ──
  children.push(heading(1, '5. Non-Conformance Report (NCR)'))
  children.push(bodyText(
    'Document any test failures or deviations below. Each NCR must include severity, root cause analysis, and resolution plan.'
  ))
  children.push(styledTable(
    ['NCR #', 'Test ID', 'Description', 'Severity', 'Resolution', 'Status'],
    [
      ['NCR-001', '', '', '', '', ''],
      ['NCR-002', '', '', '', '', ''],
      ['NCR-003', '', '', '', '', ''],
    ],
    [900, 900, 2200, 1200, 2200, 1626]
  ))

  // ── 6. Conclusion ──
  children.push(heading(1, '6. Conclusion and Recommendation'))
  children.push(bodyText('Based on the test results above, the following recommendation is made:'))
  children.push(bodyText(' '))
  children.push(bodyText('\u2610  System ACCEPTED for shipment to customer site'))
  children.push(bodyText('\u2610  System ACCEPTED with conditions (see NCR list for items to resolve before/during SAT)'))
  children.push(bodyText('\u2610  System REJECTED (critical failures must be resolved, re-test required)'))
  children.push(bodyText(' '))
  children.push(bodyText('Additional remarks:'))
  children.push(bodyText('_____________________________________________________________________________'))
  children.push(bodyText('_____________________________________________________________________________'))

  // ── 7. Sign-Off ──
  children.push(heading(1, '7. Sign-Off'))
  children.push(bodyText('By signing below, the parties confirm they have witnessed the FAT and agree with the test results documented in this report.'))
  children.push(bodyText(' '))
  children.push(signOffTable([
    { org: COMPANY.name, role: 'Test Engineer' },
    { org: COMPANY.name, role: 'Project Manager' },
    { org: CUSTOMER, role: 'Witness' },
    { org: CUSTOMER, role: 'Project Manager' },
  ]))

  // ── Assemble ──
  const sections = [
    coverPage('Factory Acceptance Test (FAT) Report', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('FAT Report', children),
  ]

  await buildAndSave(sections, '05_FAT_Report.docx')
  console.log(`\n📊 Test cases: ${allTests.length} across ${categories.length} categories`)
}

generate().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
