/**
 * Document 4: Troubleshooting Guide
 * INDUSIA AI Visual Inspection System
 *
 * Audience: Technicians, Engineers, Operators
 * Purpose: Detailed symptom → cause → fix reference
 *
 * Usage: node scripts/docs/generate-troubleshooting.js "PT Customer Name"
 */

const path = require('path')
const utils = require('./doc-utils')
const {
  heading, bodyText, bullet, callout, numberedStep, styledTable,
  coverPage, revisionHistory, contentSection, tableOfContents, buildAndSave,
  embedScreenshot, HARDWARE_IMAGES_DIR, CONTENT_WIDTH, COMPANY,
} = utils

const CUSTOMER = process.argv[2] || '[Customer Name]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-DOC-004'

const hw = (name) => path.join(HARDWARE_IMAGES_DIR, name)

async function generate() {
  console.log(`\nGenerating Troubleshooting Guide for: ${CUSTOMER}\n`)

  const children = []
  let figNum = 1

  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial release'))
  children.push(...tableOfContents())

  // ══════════════════════════════════════════════════════════════
  // 1. INTRODUCTION
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '1. Introduction'))

  children.push(heading(2, '1.1 How to Use This Guide'))
  children.push(bodyText(
    'This guide provides systematic troubleshooting procedures for the INDUSIA AI Visual Inspection System. Start with the Quick Reference Symptom Table (Section 2) to identify your issue, then follow the detailed resolution steps in the corresponding section.'
  ))

  children.push(heading(2, '1.2 Severity Levels'))
  children.push(styledTable(
    ['Level', 'Description', 'Response Time', 'Action'],
    [
      ['CRITICAL', 'Machine cannot operate, production stopped', 'Immediate', 'Stop production, press E-Stop if unsafe, contact support'],
      ['MAJOR', 'System degraded, partial functionality lost', '< 4 hours', 'Workaround if available, plan maintenance window'],
      ['MINOR', 'Cosmetic or non-blocking issue', '< 24 hours', 'Schedule maintenance at next convenient time'],
    ],
    [1200, 2800, 1500, 3526]
  ))

  children.push(heading(2, '1.3 Escalation Procedure'))
  children.push(numberedStep('Operator identifies issue and checks this troubleshooting guide.'))
  children.push(numberedStep('If not resolved, escalate to on-site maintenance technician.'))
  children.push(numberedStep('If not resolved, contact INDUSIA AI support: [Support Contact]'))
  children.push(numberedStep('For CRITICAL issues requiring remote support, provide: machine serial, error description, screenshots.'))

  // ══════════════════════════════════════════════════════════════
  // 2. QUICK REFERENCE — SYMPTOM TABLE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '2. Quick Reference — Symptom Table'))
  children.push(bodyText('Find your symptom below and follow the reference to the detailed section:'))

  children.push(styledTable(
    ['Symptom', 'Possible Cause', 'Quick Fix', 'Severity', 'See Section'],
    [
      // Hardware
      ['Machine won\'t power on', 'No AC power, RCCB tripped', 'Check AC cable, reset RCCB', 'CRITICAL', '3.1'],
      ['AC ONLINE lamp OFF', 'Power cable disconnected', 'Reconnect power cable', 'CRITICAL', '3.1'],
      ['PLC not operating, camera not moving', 'Sensor not detected, incorrect mechanical position', 'Press E-Stop, reposition camera manually', 'CRITICAL', '3.2'],
      ['PLC disconnect', 'Incorrect IP/serial configuration', 'Verify PLC serial connection (RS232)', 'MAJOR', '3.2'],
      ['Camera shows black/dark image', 'Cam Lamp OFF, MCB 2 tripped', 'Turn ON Cam Lamp, check MCB 2', 'MAJOR', '3.3'],
      ['Camera shows blurry image', 'Focus ring shifted', 'Recalibrate focus (Maintenance Manual §3.2)', 'MAJOR', '3.3'],
      ['Pneumatic cylinder not actuating', 'Low air pressure, solenoid failure', 'Check 6 bar pressure, check solenoid', 'MAJOR', '3.4'],
      ['PCB flip not completing 180°', 'Rotary table issue, low air pressure', 'Check rotary table, verify 6 bar', 'CRITICAL', '3.4'],
      // Software
      ['HMI not loading in browser', 'Next.js server down (port 3000)', 'Restart HMI service', 'MAJOR', '4.1'],
      ['Login failed', 'Wrong credentials, account inactive', 'Verify credentials, contact admin', 'MINOR', '4.2'],
      ['SSE connection lost / no real-time updates', 'AI Backend down (port 8002)', 'Check AI Backend service', 'CRITICAL', '4.3'],
      ['Database errors / data not saving', 'PostgREST down (port 3001)', 'Restart PostgREST service', 'CRITICAL', '4.4'],
      // AI
      ['High false call rate (> 25%)', 'Camera/lighting degraded, wrong model', 'Recalibrate camera, verify AI model', 'MAJOR', '5.1'],
      ['AI confidence consistently low (< 60%)', 'Dirty lens, PCB variant not trained', 'Clean lens, may need model retraining', 'MAJOR', '5.2'],
      ['Inspection too slow', 'CPU overloaded, network issue', 'Check edge device CPU load', 'MINOR', '5.3'],
      // Automation
      ['Conveyor not moving', 'Sensor not detected, PLC issue', 'Check sensors, PLC status', 'CRITICAL', '6.1'],
      ['E-Stop recovery fails', 'E-Stop not fully released', 'Twist E-Stop clockwise to release', 'CRITICAL', '6.2'],
      // Network
      ['Cloud sync failed', 'No internet, bridge PC issue', 'Check bridge PC, network config', 'MINOR', '7.1'],
    ],
    [2200, 2000, 2000, 1200, 1626]
  ))

  // ══════════════════════════════════════════════════════════════
  // 3. HARDWARE ISSUES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '3. Hardware Issues'))

  children.push(...embedScreenshot(hw('image01.jpg'), 'Machine Front Panel — Component Reference', figNum++))

  // 3.1 Power Issues
  children.push(heading(2, '3.1 Machine Won\'t Power On'))
  children.push(bodyText('Severity: CRITICAL'))
  children.push(heading(3, 'Symptoms'))
  children.push(bullet('No lights on the machine'))
  children.push(bullet('AC ONLINE lamp is OFF'))
  children.push(bullet('POWER ON lamp is OFF'))
  children.push(heading(3, 'Diagnostic Steps'))
  children.push(numberedStep('Check the power cable is securely connected to the 220VAC source.'))
  children.push(numberedStep('Verify the wall outlet has power (test with another device).'))
  children.push(numberedStep('Check the Main Switch is in the ON position.'))
  children.push(numberedStep('Check RCCB — if it has tripped, the lever will be in the middle/off position.'))
  children.push(numberedStep('Check MCB 1, MCB 2, MCB 3 — all must be in the ON position.'))
  children.push(heading(3, 'Resolution'))
  children.push(bullet('If RCCB tripped: Reset by pushing lever UP. If it trips again immediately, there may be a ground fault — contact an electrician.'))
  children.push(bullet('If MCB tripped: Reset by pushing lever UP. If it trips again, check for short circuit in the corresponding circuit (MCB 1 = camera/display, MCB 2 = fan/lamps, MCB 3 = PLC/power supply).'))
  children.push(bullet('If Main Switch is damaged: Replace (SIJIN LW-26-32, 32A rated).'))

  // 3.2 PLC Issues
  children.push(heading(2, '3.2 PLC Issues'))
  children.push(bodyText('Severity: CRITICAL'))
  children.push(heading(3, 'PLC Not Operating / Camera Not Moving'))
  children.push(numberedStep('Press Emergency Stop immediately if any unsafe movement detected.'))
  children.push(numberedStep('Check if the position sensor (Omron EE-SX671) is detecting the camera carriage correctly.'))
  children.push(numberedStep('Manually move the camera carriage to the center position (home position).'))
  children.push(numberedStep('Check the PLC status LEDs on the Omron CP1L unit (inside panel).'))
  children.push(numberedStep('Verify RS232 serial cable is connected: PLC → Omron CP1W CIF01 → Aten UC232A → CPU USB port.'))
  children.push(numberedStep('Restart the machine: Power OFF, wait 10 seconds, Power ON.'))

  children.push(heading(3, 'PLC Communication Disconnect'))
  children.push(numberedStep('Check the RS232 serial cable connection between PLC and edge device.'))
  children.push(numberedStep('Verify the Aten UC232A USB-to-Serial adapter is properly connected.'))
  children.push(numberedStep('Check the COM port assignment in the system.'))
  children.push(numberedStep('Restart the AI Backend service if communication does not recover.'))

  // 3.3 Camera Issues
  children.push(heading(2, '3.3 Camera Issues'))
  children.push(bodyText('Severity: MAJOR'))

  children.push(...embedScreenshot(hw('image03.jpg'), 'Camera Chamber — Troubleshooting Reference', figNum++))

  children.push(heading(3, 'Camera Shows Black or Dark Image'))
  children.push(numberedStep('Check Cam Lamp switch is ON.'))
  children.push(numberedStep('Check MCB 2 is ON (controls Box Lamp and UV Lamp power).'))
  children.push(numberedStep('Verify the Cam Lamp dimmer/potentiometer setting (target: 1318 lux).'))
  children.push(numberedStep('Check the 10GigE cable connection between camera and edge device.'))
  children.push(numberedStep('Restart the AI Backend service.'))

  children.push(heading(3, 'Camera Shows Blurry Image'))
  children.push(numberedStep('Check if the lens focus ring has shifted (vibration can cause this).'))
  children.push(numberedStep('Clean the camera lens with a dry microfiber cloth.'))
  children.push(numberedStep('Recalibrate focus following Maintenance Manual Section 3.2.'))

  children.push(heading(3, 'Camera Shows Overexposed (Too Bright) Image'))
  children.push(numberedStep('Check if both Cam Lamp AND UV Lamp are on — UV should only be on for specific part numbers.'))
  children.push(numberedStep('Reduce the Cam Lamp dimmer setting.'))
  children.push(numberedStep('Verify the correct AI model is selected for the current part number.'))

  // 3.4 Pneumatic Issues
  children.push(heading(2, '3.4 Pneumatic Issues'))
  children.push(bodyText('Severity: MAJOR to CRITICAL'))

  children.push(heading(3, 'Cylinder Not Actuating'))
  children.push(numberedStep('Check air pressure at filter regulator — must read 6 bar.'))
  children.push(numberedStep('Inspect air hoses for kinks, disconnections, or leaks (listen for hissing).'))
  children.push(numberedStep('Check solenoid valves (SMC SY3120-5LZD-M5): LED indicator should light when activated.'))
  children.push(numberedStep('Check speed controllers (SMC AS1201F series) are not fully closed.'))
  children.push(numberedStep('If cylinder moves slowly: Adjust speed controller. If no movement: Replace solenoid valve.'))

  children.push(heading(3, 'PCB Flip Not Completing 180°'))
  children.push(numberedStep('Check rotary table (SMC MSQB-10A) for mechanical obstruction.'))
  children.push(numberedStep('Verify air pressure is at 6 bar.'))
  children.push(numberedStep('Check auto-switch sensors (D-M9B) are detecting end-of-rotation correctly.'))
  children.push(numberedStep('Check shock absorbers (SMC RBC1007) are not over-tightened.'))
  children.push(callout('WARNING', 'If the flip does not complete 180°, the BOTTOM side inspection will capture the wrong angle. This is a CRITICAL issue — stop production until resolved.'))

  // ══════════════════════════════════════════════════════════════
  // 4. SOFTWARE / HMI ISSUES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '4. Software / HMI Issues'))

  // 4.1 HMI Not Loading
  children.push(heading(2, '4.1 HMI Not Loading in Browser'))
  children.push(bodyText('Severity: MAJOR'))
  children.push(heading(3, 'Symptoms'))
  children.push(bullet('Browser shows "Cannot connect" or blank page'))
  children.push(bullet('Browser shows error message'))
  children.push(heading(3, 'Diagnostic Steps'))
  children.push(numberedStep('Verify the edge device (Geekom IT13) is powered on and running.'))
  children.push(numberedStep('Check if the HMI service is running on port 3000.'))
  children.push(numberedStep('Try accessing http://localhost:3000 directly from the edge device.'))
  children.push(numberedStep('Check if PostgREST (port 3001) is running — HMI depends on database access.'))
  children.push(numberedStep('Check if AI Backend (port 8002) is running — required for live inspection.'))
  children.push(heading(3, 'Resolution'))
  children.push(styledTable(
    ['Service', 'Port', 'How to Check', 'How to Restart'],
    [
      ['HMI (Next.js)', '3000', 'Open http://localhost:3000', 'Restart from System Update or reboot edge device'],
      ['Database API (PostgREST)', '3001', 'Open http://localhost:3001', 'Restart PostgREST service'],
      ['AI Backend', '8002', 'Open http://localhost:8002/health', 'Restart AI Backend service'],
    ],
    [2200, 800, 2800, 3226]
  ))
  children.push(callout('NOTE', 'Services must start in order: PostgREST (3001) → AI Backend (8002) → HMI (3000). If in doubt, restart the edge device — all services will start automatically.'))

  // 4.2 Login Issues
  children.push(heading(2, '4.2 Login Failed'))
  children.push(bodyText('Severity: MINOR'))
  children.push(numberedStep('Verify email and password are correct (check caps lock).'))
  children.push(numberedStep('Check if the user account is active — deactivated accounts cannot login.'))
  children.push(numberedStep('Contact Super Admin to verify account status or reset password.'))
  children.push(numberedStep('If ALL users cannot login, the database may be down — check PostgREST (port 3001).'))

  // 4.3 SSE / Real-time Issues
  children.push(heading(2, '4.3 Live Inspection — No Real-time Updates'))
  children.push(bodyText('Severity: CRITICAL'))
  children.push(heading(3, 'Symptoms'))
  children.push(bullet('Live inspection view shows "Connecting..." or no updates'))
  children.push(bullet('Stage indicators not progressing'))
  children.push(bullet('Board images not appearing after physical inspection'))
  children.push(heading(3, 'Diagnostic Steps'))
  children.push(numberedStep('Check AI Backend is running: http://localhost:8002/health should return {"status":"ok"}.'))
  children.push(numberedStep('Check the HMI connection indicator on the live inspection page.'))
  children.push(numberedStep('The system automatically retries connection (up to 10 times). Wait 30 seconds.'))
  children.push(numberedStep('If reconnection fails: Refresh the browser page.'))
  children.push(numberedStep('If still failing: Restart the AI Backend service, then refresh the HMI page.'))

  // 4.4 Database Issues
  children.push(heading(2, '4.4 Data Not Saving / Database Errors'))
  children.push(bodyText('Severity: CRITICAL'))
  children.push(numberedStep('Check PostgREST service is running on port 3001.'))
  children.push(numberedStep('Check PostgreSQL database is running on port 5432.'))
  children.push(numberedStep('Verify disk space on the edge device — full disk prevents database writes.'))
  children.push(numberedStep('Restart PostgREST, then restart HMI if needed.'))

  // ══════════════════════════════════════════════════════════════
  // 5. AI / INSPECTION ISSUES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '5. AI / Inspection Issues'))

  // 5.1 High False Call Rate
  children.push(heading(2, '5.1 High False Call Rate (> 25%)'))
  children.push(bodyText('Severity: MAJOR'))
  children.push(bodyText('A high false call rate means the AI and operators frequently disagree. Common causes:'))
  children.push(heading(3, 'Diagnostic Steps'))
  children.push(numberedStep('Check camera focus — blurry images cause false detections.'))
  children.push(numberedStep('Check lighting — verify Cam Lamp is calibrated to 1318 lux.'))
  children.push(numberedStep('Verify the correct AI model is selected for the current Part Number.'))
  children.push(numberedStep('Check UV Lamp setting — must match Part Number requirements.'))
  children.push(numberedStep('Inspect PCB samples — contaminated or warped boards cause false results.'))
  children.push(heading(3, 'Resolution'))
  children.push(bullet('Recalibrate camera focus and lighting (Maintenance Manual §3.2, §3.3).'))
  children.push(bullet('Run a golden board verification test.'))
  children.push(bullet('If FCR remains high after calibration, the AI model may need retraining. Contact INDUSIA AI support.'))
  children.push(callout('NOTE', 'False calls from contaminated/warped/damaged samples are excluded from performance metrics per the acceptance criteria.'))

  // 5.2 Low Confidence
  children.push(heading(2, '5.2 AI Confidence Consistently Low (< 60%)'))
  children.push(bodyText('Severity: MAJOR'))
  children.push(numberedStep('Clean the camera lens (Maintenance Manual §3.1).'))
  children.push(numberedStep('Recalibrate lighting (Maintenance Manual §3.3).'))
  children.push(numberedStep('Check if the PCB variant is in the training dataset — new variants need model update.'))
  children.push(numberedStep('If the issue persists, the model may need retraining with more samples. Contact INDUSIA AI support.'))

  // 5.3 Slow Inspection
  children.push(heading(2, '5.3 Inspection Too Slow'))
  children.push(bodyText('Severity: MINOR'))
  children.push(bodyText('Expected inference time: < 30ms per image, < 60ms total for dual-side.'))
  children.push(numberedStep('Check CPU and memory usage on the edge device (Task Manager).'))
  children.push(numberedStep('Close any unnecessary applications running on the edge device.'))
  children.push(numberedStep('Check if the 10GigE camera cable is properly connected (slow transfer = long capture time).'))
  children.push(numberedStep('Restart the AI Backend service to clear any memory accumulation.'))

  // ══════════════════════════════════════════════════════════════
  // 6. PLC & AUTOMATION ISSUES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '6. PLC & Automation Issues'))

  // 6.1 Conveyor Issues
  children.push(heading(2, '6.1 Conveyor Not Moving'))
  children.push(bodyText('Severity: CRITICAL'))
  children.push(numberedStep('Press E-Stop as a precaution.'))
  children.push(numberedStep('Check all 3 position sensors (Omron EE-SX671) — they detect the camera carriage position.'))
  children.push(numberedStep('Manually move the camera carriage to clear any obstruction.'))
  children.push(numberedStep('Check the linear belt actuator motor and connections.'))
  children.push(numberedStep('Verify PLC is running (status LEDs on Omron CP1L panel).'))
  children.push(numberedStep('Release E-Stop (twist clockwise) and restart the inspection cycle.'))

  // 6.2 E-Stop Recovery
  children.push(heading(2, '6.2 Emergency Stop Recovery'))
  children.push(bodyText('After an E-Stop event:'))
  children.push(numberedStep('Identify and resolve the cause of the E-Stop activation.'))
  children.push(numberedStep('Release the E-Stop button by twisting it clockwise until it pops out.'))
  children.push(numberedStep('Reset the machine by turning Main Switch OFF, then ON again.'))
  children.push(numberedStep('Wait for the PLC to complete its startup sequence (all sensor LEDs should be stable).'))
  children.push(numberedStep('On the HMI, restart the inspection session.'))
  children.push(callout('WARNING', 'Do NOT resume operations until the root cause of the E-Stop is identified and resolved.'))

  // ══════════════════════════════════════════════════════════════
  // 7. NETWORK & SYNC ISSUES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '7. Network & Cloud Sync Issues'))

  children.push(heading(2, '7.1 Cloud Sync Failed'))
  children.push(bodyText('Severity: MINOR (does not affect real-time inspection)'))
  children.push(bodyText('Cloud sync requires internet connectivity via the bridge PC. Inspection operates independently.'))
  children.push(numberedStep('Check if the bridge PC is powered on and connected to both factory and office networks.'))
  children.push(numberedStep('Verify internet connectivity from the bridge PC.'))
  children.push(numberedStep('Check the sync status in HMI: Cloud Sync → History.'))
  children.push(numberedStep('If sync lock is stuck, use "Force Release Lock" option in the sync menu.'))
  children.push(numberedStep('Try manual sync again.'))

  children.push(heading(2, '7.2 Internal Network Issues'))
  children.push(bodyText('All three services (HMI, AI Backend, PostgREST) run on the same edge device via localhost. Network issues are rare but can occur:'))
  children.push(bullet('Port conflict: Another application using port 3000, 3001, or 8002'))
  children.push(bullet('Firewall blocking local connections'))
  children.push(bullet('Solution: Restart the edge device to clear all port bindings'))

  // ══════════════════════════════════════════════════════════════
  // 8. WARRANTY vs NON-WARRANTY
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '8. Warranty vs Non-Warranty Issues'))
  children.push(bodyText('Use this reference to determine if an issue is covered under warranty:'))

  children.push(styledTable(
    ['Category', 'Covered (Warranty)', 'NOT Covered'],
    [
      ['Hardware', 'Manufacturing defects, component failure under normal use', 'Physical impact, water damage, unauthorized modifications'],
      ['Software', 'Bugs in delivered software, system crashes', 'Unapproved software installations, OS modifications'],
      ['PLC', 'PLC failure, communication board defect', 'Incorrect wiring by customer, voltage surge'],
      ['Camera', 'Sensor defect, firmware issues', 'Lens scratches from improper cleaning'],
      ['Pneumatic', 'Solenoid valve defect, rotary table failure', 'Seal wear (consumable), insufficient air supply'],
      ['AI Model', 'Detection accuracy below spec (with valid samples)', 'New PCB variants not in training data'],
      ['Network', 'Factory LAN connectivity issues', 'Customer internet/firewall changes'],
    ],
    [1500, 3763, 3763]
  ))

  children.push(heading(2, '8.1 Warranty Period'))
  children.push(styledTable(
    ['Item', 'Duration'],
    [
      ['Hardware Warranty', '12 months from FAT acceptance'],
      ['Software Warranty', '6 months from FAT acceptance'],
      ['Hypercare (on-site support)', '30 days post-SAT'],
    ],
    [4513, 4513]
  ))

  // ══════════════════════════════════════════════════════════════
  // APPENDIX
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, 'Appendix A: Service Ports Reference'))
  children.push(styledTable(
    ['Service', 'Port', 'URL', 'Health Check'],
    [
      ['HMI Application', '3000', 'http://localhost:3000', 'Page loads in browser'],
      ['Database API (PostgREST)', '3001', 'http://localhost:3001', 'Returns JSON schema'],
      ['AI Backend', '8002', 'http://localhost:8002/health', 'Returns {"status":"ok"}'],
      ['PostgreSQL', '5432', 'Internal', 'Accessed via PostgREST'],
    ],
    [2500, 800, 3200, 2526]
  ))

  children.push(heading(1, 'Appendix B: Contact Information'))
  children.push(styledTable(
    ['Contact', 'Detail'],
    [
      ['Provider', COMPANY.name],
      ['Sales Manager', COMPANY.salesManager],
      ['Project Manager', COMPANY.projectManager],
      ['Support Email', '[support@indusia.ai]'],
      ['Support Phone', '[Phone Number]'],
      ['Emergency Contact', '[Emergency Phone]'],
    ],
    [3000, 6026]
  ))

  // ── Assemble & Save ──
  const sections = [
    coverPage('Troubleshooting Guide', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('Troubleshooting Guide', children),
  ]

  await buildAndSave(sections, '04_Troubleshooting_Guide.docx')
  console.log(`\n📊 Sections: 8 + 2 appendices | Symptom table: 18 items | Hardware images: ${figNum - 1}`)
}

generate().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
