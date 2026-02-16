/**
 * Document 3: Maintenance Manual
 * INDUSIA AI Visual Inspection System
 *
 * Audience: Maintenance technicians
 * Purpose: Preventive maintenance procedures, spare parts, calibration
 *
 * Usage: node scripts/docs/generate-maintenance.js "PT Customer Name"
 */

const path = require('path')
const utils = require('./doc-utils')
const {
  heading, bodyText, bullet, callout, numberedStep, styledTable,
  coverPage, revisionHistory, contentSection, buildAndSave,
  embedScreenshot, screenshot, HARDWARE_IMAGES_DIR, CONTENT_WIDTH,
  tableOfContents, COMPANY,
} = utils

const CUSTOMER = process.argv[2] || '[Customer Name]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-DOC-003'

const hw = (name) => path.join(HARDWARE_IMAGES_DIR, name)

async function generate() {
  console.log(`\nGenerating Maintenance Manual for: ${CUSTOMER}\n`)

  const children = []
  let figNum = 1

  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial release'))
  children.push(...tableOfContents())

  // ══════════════════════════════════════════════════════════════
  // 1. INTRODUCTION
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '1. Introduction'))

  children.push(heading(2, '1.1 Maintenance Philosophy'))
  children.push(bodyText(
    'Regular preventive maintenance ensures reliable operation and extends the service life of the INDUSIA AI Visual Inspection System. This manual provides maintenance schedules, procedures, and spare parts information for maintenance technicians.'
  ))

  children.push(heading(2, '1.2 Safety Precautions'))
  children.push(callout('WARNING', 'ALWAYS disconnect power and release air pressure before performing any maintenance that involves opening panels, replacing parts, or accessing internal components.'))
  children.push(bullet('Lock out / tag out the main switch before maintenance'))
  children.push(bullet('Wear ESD protection when handling electronic components'))
  children.push(bullet('Release compressed air before working on pneumatic components'))
  children.push(bullet('Allow UV lamps to cool before handling'))

  children.push(heading(2, '1.3 Required Tools'))
  children.push(bullet('Microfiber cloth (dry, lint-free) for camera lens'))
  children.push(bullet('Lux meter for lighting calibration (target: 1318 lux)'))
  children.push(bullet('Multimeter for voltage testing'))
  children.push(bullet('Air pressure gauge (verify 6 bar)'))
  children.push(bullet('Standard screwdriver set (Phillips + flathead)'))
  children.push(bullet('Allen key set (M3, M4, M5)'))

  // ══════════════════════════════════════════════════════════════
  // 2. PREVENTIVE MAINTENANCE SCHEDULE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '2. Preventive Maintenance Schedule'))
  children.push(bodyText('Follow this maintenance schedule to ensure optimal system performance:'))

  children.push(styledTable(
    ['Component', 'Maintenance Action', 'Frequency'],
    [
      ['RCCB and MCB 1–3', 'Verify ON position, test RCCB trip function', 'Daily'],
      ['Air Pressure', 'Check filter regulator reads 6 bar, inspect for leaks', 'Daily'],
      ['Visual Inspection', 'Check cables, connectors, and pneumatic hoses for damage', 'Daily'],
      ['Camera Lens', 'Wipe lens using dry microfiber cloth (no liquid cleaners)', 'Weekly'],
      ['Camera Calibration', 'Rotate focus ring slowly, verify sharpness with test target', 'Weekly'],
      ['Cam Lamp', 'Verify dimmer/potentiometer setting at 1318 lux using lux meter', 'Weekly'],
      ['UV Lamp', 'Check UV intensity (only for part numbers requiring UV)', 'Weekly'],
      ['PCB Pallet & Base Jig', 'Clean surface, check locking mechanism, remove debris', 'Weekly'],
      ['Database Backup', 'Verify automatic backup or perform manual backup', 'Monthly'],
      ['System Log Review', 'Check event logs for errors or anomalies', 'Monthly'],
      ['Pneumatic Connections', 'Check all fittings, cylinders, and hoses for leaks', 'Monthly'],
      ['PLC Battery', 'Test voltage — replace if below 2.5V (Omron CJ1W-BAT01)', '6 Months'],
      ['Camera Full Calibration', 'Full focus and lighting recalibration with golden board', '6 Months'],
      ['Golden Board Verification', 'Run reference board through inspection to verify accuracy', '6 Months'],
    ],
    [2500, 4200, 2326]
  ))

  // ══════════════════════════════════════════════════════════════
  // 3. CAMERA SYSTEM MAINTENANCE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '3. Camera System Maintenance'))

  children.push(...embedScreenshot(hw('image03.jpg'), 'Camera Chamber — Maintenance Reference', figNum++))

  children.push(heading(2, '3.1 Lens Cleaning'))
  children.push(numberedStep('Power off the machine and wait for all lamps to cool.'))
  children.push(numberedStep('Open the acrylic safety cover to access the camera chamber.'))
  children.push(numberedStep('Use a dry, lint-free microfiber cloth to gently wipe the camera lens.'))
  children.push(numberedStep('Wipe in a single direction — do not use circular motions.'))
  children.push(callout('WARNING', 'NEVER use liquid cleaners, compressed air, or abrasive materials on the camera lens. This will damage the lens coating.'))

  children.push(heading(2, '3.2 Focus Calibration'))
  children.push(numberedStep('Place a resolution test target or known-good PCB on the pallet.'))
  children.push(numberedStep('Power on the system and start a test inspection.'))
  children.push(numberedStep('Slowly rotate the focus ring on the lens while observing the live image on the HMI.'))
  children.push(numberedStep('Adjust until the finest details on the board are sharp.'))
  children.push(numberedStep('Lock the focus ring position.'))
  children.push(callout('NOTE', 'Camera model: HIKROBOT MV-CS200-10GC with MVL-KF1624M-25MP lens. Focus should only be adjusted by trained technicians.'))

  children.push(heading(2, '3.3 Lighting Calibration'))
  children.push(numberedStep('Use a calibrated lux meter to measure the Cam Lamp illumination at the PCB surface.'))
  children.push(numberedStep('Target value: 1318 lux. Adjust the dimmer/potentiometer as needed.'))
  children.push(numberedStep('For UV Lamp: verify UV output is adequate for adhesive detection (applicable part numbers only).'))

  children.push(heading(2, '3.4 Golden Board Verification'))
  children.push(bodyText(
    'A "golden board" is a known-good reference PCB used to verify the inspection system is operating correctly. Run the golden board through a full inspection cycle and confirm the AI produces the expected PASS result.'
  ))
  children.push(callout('TIP', 'Perform golden board verification after every program change (new AI model) and at least every 6 months.'))

  // ══════════════════════════════════════════════════════════════
  // 4. PNEUMATIC SYSTEM
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '4. Pneumatic System Maintenance'))

  children.push(heading(2, '4.1 Air Pressure Adjustment'))
  children.push(numberedStep('Check the filter regulator gauge on the machine front panel.'))
  children.push(numberedStep('Verify the reading is 6 bar.'))
  children.push(numberedStep('If pressure is low, check the compressor output and all connections.'))
  children.push(numberedStep('Drain moisture from the filter regulator bowl as needed.'))

  children.push(heading(2, '4.2 Cylinder Inspection'))
  children.push(bodyText('Inspect the following pneumatic components monthly:'))
  children.push(styledTable(
    ['Component', 'Part Number', 'Check'],
    [
      ['Single Acting Cylinder', 'SMC CM2B20-200Z', 'Smooth actuation, no air leaks, speed controllers adjusted'],
      ['Rotary Table', 'SMC MSQB-10A', '180° rotation smooth and precise, no play'],
      ['Auto-switches (reed)', 'SMC D-M9B / D-C73', 'Properly detecting cylinder positions'],
      ['Speed Controllers', 'SMC AS1201F series', 'Flow adjustment stable, no leaks'],
      ['Shock Absorbers', 'SMC RBC1007', 'Properly dampening cylinder end-of-travel'],
      ['Air Hoses', 'TU0604B / TU0805B', 'No cracks, kinks, or leaks'],
    ],
    [2500, 2800, 3726]
  ))

  // ══════════════════════════════════════════════════════════════
  // 5. ELECTRICAL SYSTEM
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '5. Electrical System Maintenance'))

  children.push(heading(2, '5.1 RCCB/MCB Testing'))
  children.push(numberedStep('Daily: Visually verify all breakers are in the ON position.'))
  children.push(numberedStep('Monthly: Test RCCB trip function using the test button on the RCCB (Schneider A9R71225).'))
  children.push(numberedStep('Verify MCB 1–3 are functioning by checking their respective loads.'))

  children.push(heading(2, '5.2 Power Supply Verification'))
  children.push(numberedStep('Use a multimeter to verify 24VDC output from power supply (Schneider ABL2REM24065K).'))
  children.push(numberedStep('Check output is stable at 24V ± 5%.'))

  children.push(heading(2, '5.3 PLC Battery Replacement'))
  children.push(callout('WARNING', 'PLC battery must be replaced without removing power to prevent program loss.'))
  children.push(numberedStep('Measure battery voltage with multimeter. Battery: Omron CJ1W-BAT01.'))
  children.push(numberedStep('If voltage is below 2.5V, replace immediately.'))
  children.push(numberedStep('Replace battery with power ON (hot-swap) to prevent PLC program loss.'))
  children.push(numberedStep('After replacement, verify PLC communication is normal.'))

  children.push(heading(2, '5.4 Cable Inspection'))
  children.push(bodyText('Monthly: Inspect all cables and connectors for:'))
  children.push(bullet('Damage, fraying, or exposed conductors'))
  children.push(bullet('Loose connections at terminal blocks'))
  children.push(bullet('RS232 serial cable between PLC and CPU (Aten UC232A adapter)'))
  children.push(bullet('Camera 10GigE cable connection'))
  children.push(bullet('Sensor cables (Omron EE-SX671 photomicrosensors × 3)'))

  // ══════════════════════════════════════════════════════════════
  // 6. SOFTWARE MAINTENANCE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '6. Software Maintenance'))

  children.push(heading(2, '6.1 System Updates'))
  children.push(bodyText('The HMI software can be updated via the System Update menu (Super Admin access required).'))
  children.push(...embedScreenshot(
    screenshot('6_System_Update', '1_System_Update_Menu.png'),
    'System Update Menu', figNum++
  ))
  children.push(numberedStep('Login as Super Admin.'))
  children.push(numberedStep('Navigate to System Update in the sidebar.'))
  children.push(numberedStep('Click "Check for Updates" to see if a new version is available.'))
  children.push(numberedStep('Follow on-screen instructions to install the update.'))
  children.push(callout('WARNING', 'Do NOT update the system while an inspection is in progress. Stop all active work orders first.'))

  children.push(heading(2, '6.2 Database Backup'))
  children.push(bodyText('The local PostgreSQL database contains all inspection results, work orders, and configuration data. Regular backups protect against data loss.'))
  children.push(callout('NOTE', 'Cloud sync also serves as a backup for inspection data. Ensure sync is running regularly.'))

  children.push(heading(2, '6.3 Cloud Sync Verification'))
  children.push(bodyText('Monthly: Check the Sync History in the HMI to verify synchronization is running successfully:'))
  children.push(bullet('Navigate to Cloud Sync menu'))
  children.push(bullet('Check last sync timestamp is recent'))
  children.push(bullet('Verify no failed sync sessions in history'))

  // ══════════════════════════════════════════════════════════════
  // 7. SPARE PARTS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '7. Spare Parts List'))

  children.push(heading(2, '7.1 Electrical Parts'))
  children.push(styledTable(
    ['No.', 'Description', 'Part Number', 'Brand', 'Qty'],
    [
      ['1', 'Panel Cooling Fan 120x120 220VAC', 'GUS RDF1014', 'Propan', '1'],
      ['2', 'RCCB 2P 25A 30mA type AC', 'A9R71225', 'Schneider', '1'],
      ['3', 'MCB 1P 2A C curve', 'A9F74102', 'Schneider', '2'],
      ['4', 'MCB 1P 4A C curve', 'A9f74104', 'Schneider', '1'],
      ['5', 'Power Supply 24VDC 5A', 'ABL2REM24065K', 'Schneider', '1'],
      ['6', 'PLC Omron', 'CP1L-L20DT-D', 'Omron', '1'],
      ['7', 'PLC Battery', 'CJ1W-BAT01', 'Omron', '1'],
      ['8', 'Optional Board (serial)', 'CP1W CIF01', 'Omron', '1'],
      ['9', 'Photomicrosensor NPN', 'EE-SX671', 'Omron', '3'],
      ['10', 'Sensor Connector 2M', 'EE 1006', 'Omron', '3'],
      ['11', 'RS232 to USB Adapter', 'UC232A', 'Aten', '1'],
      ['12', 'Main Switch 32A', 'LW-26-32', 'SIJIN', '1'],
      ['13', 'Pilot Lamp Red 24VDC', '∅22', 'Pioline', '1'],
      ['14', 'Pilot Lamp Green 24VDC', '∅22', 'Pioline', '1'],
      ['15', 'Push Button Green 1NO', 'XB7NA1', 'Schneider', '2'],
    ],
    [600, 3200, 2000, 1500, 726]
  ))

  children.push(heading(2, '7.2 Mechanical Parts'))
  children.push(styledTable(
    ['No.', 'Description', 'Part Number', 'Qty'],
    [
      ['1', 'Linear Belt Actuator Nema 23', '-', '1'],
      ['2', 'Linear Guide Rail + Block', 'HGR20R', '1'],
      ['3', 'Pillow Block Bearing 8mm', 'KFL008', '1'],
      ['4', 'Adjustable Camera Mount', 'FT-810', '1'],
      ['5', 'T5 LED Lamp (Bench)', 'Krisbow', '2'],
      ['6', 'UV-A T8 BLB 15W (UV Lamp)', 'GOLDSTAR', '2'],
      ['7', 'Acrylic 3mm black (cover)', '-', '1'],
      ['8', 'Acrylic 5mm black + laser cut', '-', '1'],
      ['9', 'PCB Locking clips', 'DRW-08RUI-26', '40'],
      ['10', 'Shock Absorber', 'DRW-12RUI-26', '2'],
    ],
    [600, 3800, 2400, 2226]
  ))

  children.push(heading(2, '7.3 Pneumatic Parts'))
  children.push(styledTable(
    ['No.', 'Description', 'Part Number', 'Brand', 'Qty'],
    [
      ['1', 'Compact Rotary Table', 'MSQB-10A', 'SMC', '1'],
      ['2', 'Single Acting Cylinder', 'CM2B20-200Z', 'SMC', '1'],
      ['3', 'Auto-switch 24VDC (for CM2)', 'D-M9B', 'SMC', '2'],
      ['4', 'Reed Switch (for CM2)', 'D-C73', 'SMC', '2'],
      ['5', 'Solenoid Valve 24VDC', 'SY3120-5LZD-M5', 'SMC', '2'],
      ['6', 'Speed Controller M6 thrd. M3', 'AS1201F-M3-06S', 'SMC', '2'],
      ['7', 'Speed Controller M6 thrd. 1/8', 'AS1201F-01-06S', 'SMC', '2'],
      ['8', 'Air Filter Regulator + Bracket', '-', 'SMC', '1'],
      ['9', 'Nylon Air Hose M8', 'TU0604B-20', '-', '1'],
      ['10', 'Nylon Air Hose M6', 'TU0805B-20', '-', '1'],
      ['11', 'Shock Absorber', 'RBC1007', 'SMC', '2'],
    ],
    [600, 3000, 2200, 1000, 2226]
  ))

  // ══════════════════════════════════════════════════════════════
  // 8. CONSUMABLE WEAR ITEMS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '8. Consumable Wear Items'))
  children.push(bodyText('The following items experience normal wear and are NOT covered under warranty:'))
  children.push(styledTable(
    ['Item', 'Expected Lifespan', 'Replacement Indicator'],
    [
      ['LED Lighting (Cam Lamp, Box Lamp)', '> 10,000 hours', 'Dimming below calibrated lux level'],
      ['UV Lamp (T8 BLB 15W)', '> 5,000 hours', 'Reduced UV intensity, adhesive detection failures'],
      ['Pneumatic Seals', '~12 months', 'Air leaks, slow actuation, pressure loss'],
      ['Camera Lens Coating', '> 24 months', 'Scratches affecting image clarity (if improperly cleaned)'],
    ],
    [2800, 2200, 4026]
  ))

  // ══════════════════════════════════════════════════════════════
  // 9. MAINTENANCE LOG
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '9. Maintenance Log Template'))
  children.push(bodyText('Use the following format to record all maintenance activities:'))
  children.push(styledTable(
    ['Date', 'Component', 'Action Performed', 'Technician', 'Result/Notes'],
    [
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
    ],
    [1400, 1800, 2800, 1500, 1526]
  ))

  // ── Assemble & Save ──
  const sections = [
    coverPage('Maintenance Manual', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('Maintenance Manual', children),
  ]

  await buildAndSave(sections, '03_Maintenance_Manual.docx')
  console.log(`\n📊 Sections: 9 | Spare parts tables: 3 | Hardware images: ${figNum - 1}`)
}

generate().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
