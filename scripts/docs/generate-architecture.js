/**
 * Document 1: System Overview Guide
 * INDUSIA AI Visual Inspection System
 *
 * Audience: Customer management, engineering, IT
 * Purpose: High-level overview — what the system does, hardware, automation, capabilities
 * NOT: internal source code, database schema, API endpoints
 *
 * Usage: node scripts/docs/generate-architecture.js "PT Customer Name"
 */

const path = require('path')
const utils = require('./doc-utils')
const {
  heading, bodyText, bullet, callout, numberedStep, styledTable,
  coverPage, revisionHistory, contentSection, buildAndSave,
  embedScreenshot, HARDWARE_IMAGES_DIR, MECH_IMAGES_DIR, CONTENT_WIDTH,
  tableOfContents, COMPANY,
} = utils

const CUSTOMER = process.argv[2] || '[Customer Name]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-DOC-001'

// Hardware image paths
const hw = (name) => path.join(HARDWARE_IMAGES_DIR, name)
const mech = (name) => path.join(MECH_IMAGES_DIR, name)

// System architecture illustration
const ARCH_IMAGE = path.join(__dirname, '..', '..', 'docs', 'FAT_SAT', 'system-arsitecture-ai-inspection-hmi.png')

async function generate() {
  console.log(`\nGenerating System Overview Guide for: ${CUSTOMER}\n`)

  const children = []
  let figNum = 1

  // ── Revision History ──
  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial release'))

  // ── Table of Contents ──
  children.push(...tableOfContents())

  // ══════════════════════════════════════════════════════════════
  // 1. INTRODUCTION
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '1. Introduction'))

  children.push(heading(2, '1.1 System Overview'))
  children.push(bodyText(
    'The INDUSIA AI Visual Inspection System is an automated optical inspection (AOI) machine designed for PCB (Printed Circuit Board) visual quality control on production lines. The system uses industrial cameras and deep learning AI to inspect both sides (TOP and BOTTOM) of each PCB, detecting defects such as missing components, incorrect polarity, solder defects, and surface damage.'
  ))
  children.push(bodyText(
    'The system is a complete turn-key solution including the inspection machine, AI inference engine, operator HMI (Human-Machine Interface) software, and cloud data synchronization — all operating 100% on-premise with zero cloud dependency for real-time operations.'
  ))

  children.push(heading(2, '1.2 Purpose and Scope'))
  children.push(bodyText(
    'This document provides a high-level overview of the INDUSIA AI Visual Inspection System as delivered to ' + CUSTOMER + '. It covers hardware components, automation sequence, software capabilities, inspection types, acceptance criteria, environmental requirements, and warranty terms.'
  ))

  children.push(heading(2, '1.3 Glossary'))
  children.push(styledTable(
    ['Term', 'Definition'],
    [
      ['AOI', 'Automated Optical Inspection — using cameras and AI to detect PCB defects'],
      ['PCB', 'Printed Circuit Board — the board being inspected'],
      ['HMI', 'Human-Machine Interface — the touchscreen software for operators'],
      ['PLC', 'Programmable Logic Controller — controls machine automation (conveyor, flip, etc.)'],
      ['GOOD', 'Board passes inspection (no defects detected or operator confirms good)'],
      ['NG', 'No Good — board fails inspection (defects detected)'],
      ['False Call', 'AI and operator disagree — used for AI improvement'],
      ['DDR', 'Defect Detection Rate — percentage of real defects correctly identified'],
      ['FCR', 'False Call Rate — percentage of false alarms'],
      ['FPY', 'First Pass Yield — percentage of boards passing on first inspection'],
      ['SPC', 'Statistical Process Control — quality metrics tracking'],
    ],
    [2500, 6526]
  ))

  // ══════════════════════════════════════════════════════════════
  // 2. HARDWARE COMPONENTS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '2. Hardware Components'))

  children.push(heading(2, '2.1 Machine Overview'))
  children.push(bodyText('The inspection machine consists of the following major components:'))
  children.push(...embedScreenshot(hw('image01.jpg'), 'Machine Front View — Component Callout', figNum++))

  children.push(styledTable(
    ['No.', 'Component', 'Function'],
    [
      ['1', 'Display (Touchscreen)', 'Operator interface for HMI software'],
      ['2', 'CPU (Edge Device)', 'Geekom IT13 Mini PC — Intel i9-13900HK, 64GB RAM, 2TB SSD'],
      ['3', 'Pass Lamp (Green)', 'Indicates board PASSED inspection'],
      ['4', 'Fail Lamp (Red)', 'Indicates board FAILED inspection'],
      ['5', 'Emergency Stop', 'IP65 rated — halts all operations immediately'],
      ['6', 'UV Lamp', '365nm wavelength — for UV adhesive inspection'],
      ['7', 'Cam Lamp', 'White LED illumination for camera capture'],
      ['8', 'Bench Lamp', 'Operator work area illumination'],
      ['9', 'Box Lamp', 'Internal inspection chamber illumination'],
      ['10–11', 'PB START (×2)', 'Dual START buttons — both must be pressed simultaneously (safety interlock)'],
      ['12', 'Mouse & Keyboard', 'Backup input devices'],
      ['13', 'AC ONLINE Lamp', 'Indicates mains power connected'],
      ['14', 'POWER ON Lamp', 'Indicates system is powered'],
      ['15', 'Filter Regulator', 'Compressed air regulation — set to 6 bar'],
      ['16', 'Main Switch', 'Master power switch'],
    ],
    [900, 2800, 5326]
  ))

  children.push(heading(2, '2.2 PCB Loading Mechanism'))
  children.push(...embedScreenshot(hw('image02.jpg'), 'PCB Loading Area — Component Callout', figNum++))

  children.push(styledTable(
    ['No.', 'Component', 'Function'],
    [
      ['1', 'Single Acting Cylinder', 'SMC compact series — vertical lift for PCB flip'],
      ['2', 'PCB', 'The board being inspected'],
      ['3', 'PCB Pallet', 'Adjustable holder for PCB (max 206 × 135 mm)'],
      ['4', 'Base Pallet / Jig', 'Aluminum base plate (500 × 405 mm)'],
      ['5', 'Base Jig', 'Fixed mounting frame for pallet system'],
    ],
    [900, 2800, 5326]
  ))

  children.push(heading(2, '2.3 Camera & Inspection Chamber'))
  children.push(...embedScreenshot(hw('image03.jpg'), 'Camera Chamber — Component Callout', figNum++))

  children.push(styledTable(
    ['No.', 'Component', 'Function'],
    [
      ['1', 'Box Lamp', 'Internal LED illumination for consistent lighting'],
      ['2', 'Linear Roller Bracket', 'X-axis rail system for precise camera positioning'],
      ['3', 'UV Lamp', '365nm UV for adhesive coverage verification'],
      ['4', 'Camera', 'HIKROBOT MV-CS200-10GC (20.2MP, 5496×3672, Global Shutter, 10GigE)'],
      ['5', 'Cam Lamp', 'Direct LED illumination with dimmer (calibrated to 1318 lux)'],
    ],
    [900, 2800, 5326]
  ))

  children.push(heading(2, '2.4 Hardware Specifications'))
  children.push(styledTable(
    ['Component', 'Model / Specification'],
    [
      ['Camera', 'HIKROBOT MV-CS200-10GC (20.2MP, 5496×3672, Global Shutter, 10GigE)'],
      ['Lens', 'MVL-KF1624M-25MP (25MP-rated, low distortion)'],
      ['Edge Device', 'Geekom IT13 Mini PC — Intel i9-13900HK, 64GB RAM, 2TB NVMe SSD'],
      ['PLC', 'Omron CP1E/CP2E series with RS232 serial communication'],
      ['Power Supply', '24VDC, 5A rated (Schneider ABL2REM24065K)'],
      ['Electrical Protection', 'Schneider RCCB (A9R71225) + MCB 1–3 (Schneider iK60N)'],
      ['White Lighting', 'LED diffuse illumination (calibrated to 1318 lux)'],
      ['UV Lighting', '365nm wavelength LED (T8 UV-A BLB 15W)'],
      ['Pneumatic Cylinder', 'SMC CM2B20-200Z (vertical lift)'],
      ['Rotary Table', 'SMC MSQB-10A (180° precision indexing)'],
      ['Frame', 'Powder-coated steel, 800 × 610 × 800 mm'],
      ['Base Plate Jig', 'Aluminum, 500 × 405 mm'],
      ['Safety Enclosure', 'Light-tight acrylic top cover (3mm + 5mm black acrylic)'],
      ['Sensors', 'Omron EE-SX671 NPN slot-type photomicrosensor (×3)'],
      ['Stack Light', 'Red (Fail) / Green (Pass) indicator lamps (24VDC)'],
    ],
    [3000, 6026]
  ))

  // ══════════════════════════════════════════════════════════════
  // 3. SYSTEM WORKFLOW
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '3. System Workflow'))

  children.push(heading(2, '3.1 System Architecture Overview'))
  children.push(bodyText(
    'The INDUSIA AI Visual Inspection System integrates three core subsystems: PLC automation, AI vision processing, and the HMI operator interface. The following diagram shows the end-to-end data and control flow during an inspection cycle, including the AI improvement cycle that continuously enhances detection accuracy.'
  ))

  children.push(...embedScreenshot(ARCH_IMAGE, 'System Architecture — Inspection Flow & AI Improvement Cycle', figNum++))

  children.push(styledTable(
    ['Step', 'Subsystem', 'Action', 'Data Flow'],
    [
      ['1', 'Operator', 'Places PCB on jig, presses dual START buttons', '\u2192 PLC'],
      ['2', 'PLC (Omron CP1L)', 'Drives linear rail to camera position via stepper motor', '\u2192 Camera'],
      ['3', 'Camera (HIKROBOT)', 'Captures TOP side image (20.2MP, 5496\u00D73672)', '\u2192 AI Engine'],
      ['4', 'PLC', 'Activates pneumatic flip (180\u00B0 via SMC rotary table)', '\u2192 Camera'],
      ['5', 'Camera', 'Captures BOTTOM side image', '\u2192 AI Engine'],
      ['6', 'AI Engine', 'Runs deep learning inference on both images (< 60ms total)', '\u2192 HMI'],
      ['7', 'HMI', 'Displays AI result (PASS/FAIL) with defect bounding boxes', '\u2192 Operator'],
      ['8', 'Operator', 'Monitors AI result \u2014 reviews NG decisions for accuracy', '\u2192 HMI'],
      ['9', 'Operator', 'If AI NG is incorrect \u2192 submits False Call \u2192 Manager reviews \u2192 Cloud Sync', '\u2192 Cloud'],
      ['10', 'PLC', 'Actuates PASS/FAIL signal \u2014 operator removes PCB', '\u2192 Operator'],
    ],
    [600, 2200, 4000, 2226]
  ))

  children.push(heading(2, '3.2 Communication Protocols'))
  children.push(styledTable(
    ['From', 'To', 'Protocol', 'Purpose'],
    [
      ['PLC', 'AI Engine', 'RS232 Serial (via Aten UC232A USB adapter)', 'Motion control commands, sensor status'],
      ['Camera', 'AI Engine', '10GigE Ethernet (direct)', 'High-resolution image transfer'],
      ['AI Engine', 'HMI', 'HTTP + SSE (4 event streams)', 'Inspection results, stage progress, device status'],
      ['HMI', 'Database', 'REST API (PostgREST)', 'Data storage (inspections, work orders, overrides)'],
      ['HMI', 'Cloud', 'HTTPS (Supabase)', 'Periodic data sync for analytics and AI retraining'],
    ],
    [1500, 1500, 3000, 3026]
  ))

  children.push(heading(2, '3.3 Data Flow Diagram'))
  children.push(bodyText(
    'The following shows the complete data flow for a single inspection cycle:'
  ))
  children.push(bodyText(' '))

  children.push(styledTable(
    ['System Data Flow \u2014 Inspection & AI Improvement Cycle'],
    [
      ['PCB LOADED \u2192 Operator presses START \u2192 PLC receives START signal'],
      ['PLC \u2192 Serial Command \u2192 AI Engine: "Move camera to position 1"'],
      ['Camera \u2192 10GigE \u2192 AI Engine: TOP image (20.2MP raw)'],
      ['PLC \u2192 Serial Command \u2192 AI Engine: "Flip PCB 180\u00B0"'],
      ['Camera \u2192 10GigE \u2192 AI Engine: BOTTOM image (20.2MP raw)'],
      ['AI Engine \u2192 Deep Learning Model \u2192 Inference result (PASS/FAIL + bounding boxes)'],
      ['AI Engine \u2192 SSE \u2192 HMI: Real-time result with defect overlay'],
      ['Operator monitors AI result \u2192 Reviews NG decisions for accuracy'],
      ['If AI NG is incorrect: Operator submits False Call \u2192 Saved to local database'],
      ['Manager reviews False Call in Override Queue \u2192 Approves or Rejects'],
      ['Manager triggers Cloud Sync \u2192 Approved false calls uploaded to ' + COMPANY.name + ' database'],
      [COMPANY.name + ' retrains AI model with false call data \u2192 Deploys updated model via OTA'],
      ['Updated AI model loaded on production line \u2192 Same false call no longer occurs'],
    ],
    [9026]
  ))

  // ══════════════════════════════════════════════════════════════
  // 4. AUTOMATION SEQUENCE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '4. Automation Sequence'))
  children.push(bodyText(
    'The inspection process follows a 9-step automated sequence controlled by the PLC. The full dual-side inspection cycle completes in under 60 seconds.'
  ))

  children.push(callout('NOTE', 'The dual START button interlock requires the operator to press both buttons simultaneously, ensuring hands are clear of the machine during operation.'))

  children.push(numberedStep('Operator places PCB on holder jig and locks the PCB pallet'))
  children.push(numberedStep('Operator presses both START buttons simultaneously (dual-button safety interlock)'))
  children.push(numberedStep('PLC moves camera to position via linear rail; triggers TOP side camera capture'))
  children.push(numberedStep('Pneumatic cylinder and rotary table flip PCB 180°'))
  children.push(numberedStep('PLC triggers BOTTOM side camera capture'))
  children.push(numberedStep('AI inference engine processes both images (< 30ms per image, < 60ms total)'))
  children.push(numberedStep('PASS/FAIL result displayed on HMI touchscreen with defect highlights'))
  children.push(numberedStep('Operator monitors AI result — if AI marks NG, operator reviews to confirm or override (false call)'))
  children.push(numberedStep('PCB returned to load position; operator unloads and loads next board'))

  children.push(bodyText(' '))
  children.push(styledTable(
    ['Phase', 'Action', 'Duration'],
    [
      ['1. PCB IN', 'Operator loads board, presses START', 'Manual'],
      ['2. CAMERA MOVE', 'Linear rail positions camera', '~3 sec'],
      ['3. CAPTURE TOP', 'Top camera fires, image captured', '< 1 sec'],
      ['4. FLIP', 'Pneumatic 180° rotation', '~3 sec'],
      ['5. CAPTURE BTM', 'Bottom camera fires, image captured', '< 1 sec'],
      ['6. AI INSPECT', 'Deep learning inference on both images', '< 60 ms'],
      ['7. RESULT', 'PASS/FAIL shown, operator confirms', 'Manual'],
    ],
    [2000, 4500, 2526]
  ))
  children.push(bodyText('Total automated cycle time (steps 3–7): < 10 seconds. Overall cycle including operator: < 60 seconds.'))

  // ══════════════════════════════════════════════════════════════
  // 5. SOFTWARE OVERVIEW
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '5. Software Overview'))
  children.push(bodyText(
    'The INDUSIA AI system runs three integrated software services on the edge device. All services operate 100% on-premise — no internet connection is required for real-time inspection operations.'
  ))

  children.push(styledTable(
    ['Service', 'Function', 'Technology'],
    [
      ['AI Inspection Engine', 'Camera control, AI inference, PLC communication, real-time event streaming', 'Python-based (FastAPI)'],
      ['Database API', 'Local data storage for inspections, work orders, users, overrides', 'PostgreSQL + PostgREST'],
      ['HMI Application', 'Operator touchscreen interface, work orders, management, cloud sync', 'Web-based (Next.js)'],
    ],
    [2200, 4300, 2526]
  ))

  children.push(heading(2, '5.1 HMI Features'))
  children.push(bodyText('The HMI provides role-based access for different user types:'))
  children.push(styledTable(
    ['Role', 'Access'],
    [
      ['Operator', 'Live inspection, GOOD/NG decisions, false call submission, work order view'],
      ['Manager', 'Override review queue, dashboard analytics, cloud sync management'],
      ['Engineer', 'Master data management (boards, lines, sections), work order creation'],
      ['Super Admin', 'User/role management, permission matrix, system updates'],
    ],
    [2000, 7026]
  ))

  children.push(heading(2, '5.2 Key Software Capabilities'))
  children.push(bullet('Real-time AI inspection with live camera feed and defect bounding box overlay'))
  children.push(bullet('Work Order Management with intelligent production tracking — the system tracks the number of boards inspected against the work order lot size in real-time. When the target quantity is reached (e.g., 1000/1000 boards), the machine automatically stops and the work order status is set to Completed.'))
  children.push(bullet('Work Order On-Hold and Resume — if production needs to be paused mid-run to prioritize a more urgent model, the administrator can set the current work order to "On Hold" and create a new work order for the urgent model. Once the urgent run is complete, the original work order can be resumed with all counters preserved. As a safety measure, the On Hold option is only available when the machine is not actively running an inspection — the system prevents status changes while production is in progress.'))
  children.push(bullet('False call workflow — operator disagrees with AI → captured for model improvement'))
  children.push(bullet('Override review queue — manager approves/rejects operator overrides'))
  children.push(bullet('Cloud synchronization — periodic upload of inspection data to ' + COMPANY.name + '\'s cloud database'))
  children.push(bullet('Self-service OTA (Over-the-Air) system updates — the Super Admin can check for available software updates and install them directly from the HMI interface without requiring external support. Updates include new features, performance improvements, bug fixes, and AI model enhancements.'))
  children.push(bullet('Multi-language support (English and Bahasa Indonesia)'))
  children.push(bullet('Keyboard shortcuts for fast operation (G = GOOD, N = NG, ? = Help)'))

  // ══════════════════════════════════════════════════════════════
  // 6. INSPECTION CAPABILITIES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '6. Inspection Capabilities'))

  children.push(heading(2, '6.1 Supported Inspection Types'))
  children.push(bullet('Component presence/absence detection'))
  children.push(bullet('Polarity verification (diodes, capacitors, ICs)'))
  children.push(bullet('Visual solder quality assessment (bridges, insufficient solder)'))
  children.push(bullet('Label/marking verification'))
  children.push(bullet('UV adhesive coverage validation (365nm wavelength)'))
  children.push(bullet('PCB surface damage detection'))

  children.push(heading(2, '6.2 System Limitations'))
  children.push(callout('NOTE', 'The following inspection types are outside the scope of this 2D top-down optical system:'))
  children.push(bullet('No 3D solder height measurement (requires laser profilometry)'))
  children.push(bullet('No coplanarity verification (requires side-view cameras)'))
  children.push(bullet('No side-view defect detection (top-down imaging only)'))
  children.push(bullet('No fine-pitch inspection < 0.4 mm (optical resolution constraint)'))
  children.push(bullet('No component internal defect detection (requires X-ray)'))

  children.push(heading(2, '6.3 Inference Performance'))
  children.push(styledTable(
    ['Metric', 'Value'],
    [
      ['Inference Speed', '< 30 ms per image'],
      ['Dual-side Total', '< 60 ms'],
      ['Power Consumption', '< 15 W (edge device)'],
      ['Operating Temperature', '0°C to 50°C'],
    ],
    [4513, 4513]
  ))

  // ══════════════════════════════════════════════════════════════
  // 7. ACCEPTANCE CRITERIA
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '7. Acceptance Criteria (FAT/SAT)'))
  children.push(bodyText('The following performance targets apply during Factory Acceptance Test (FAT) and Site Acceptance Test (SAT):'))

  children.push(styledTable(
    ['Metric', 'Target', 'Notes'],
    [
      ['AI Accuracy', '≥ 95% per PCB model', 'Only visually detectable defects under 2D top-down setup'],
      ['False Negative Rate', '≤ 5%', 'Defects missed by AI'],
      ['False Positive Rate', '≤ 5%', 'GOOD boards flagged as NG'],
      ['Cycle Time', '≤ 60 seconds', 'Full dual-side inspection cycle'],
      ['Detection Rate (DDR)', '≥ 97%', 'SPC metric'],
      ['False Call Rate (FCR)', '< 10%', 'SPC metric'],
      ['First Pass Yield (FPY)', '> 95%', 'SPC metric'],
      ['Escape Rate', '< 1%', 'SPC metric'],
    ],
    [2500, 2500, 4026]
  ))

  children.push(heading(2, '7.1 FAT Sample Requirements'))
  children.push(bodyText('Minimum 100 GOOD + 100 NG boards per PCB model, using clean production-grade samples.'))

  children.push(heading(2, '7.2 Exclusion Clauses'))
  children.push(bodyText('Performance evaluation excludes failures caused by:'))
  children.push(bullet('Defects below visibility threshold (inadequate contrast, size, or clarity)'))
  children.push(bullet('Contaminated, flux-residue, warped, or physically damaged samples'))
  children.push(bullet('Sample inconsistency or non-standard defects'))
  children.push(bullet('Environmental instability'))
  children.push(bullet('Operator error'))
  children.push(bullet('Changes in PCB characteristics post-validation'))

  children.push(heading(2, '7.3 AI Continuous Learning and Accuracy Stabilization'))
  children.push(bodyText(
    'The INDUSIA AI system is built on a self-improving deep learning architecture. The AI model continuously evolves and strengthens its detection capabilities as it processes more production data. This is a fundamental design principle — not a limitation, but a competitive advantage that ensures the system becomes increasingly precise over time.'
  ))

  children.push(heading(3, 'Initial Deployment Baseline'))
  children.push(bodyText(
    'During the initial deployment phase, the AI model has been trained using the PCB reference samples provided by ' + CUSTOMER + '. Due to the limited availability of physical samples — particularly for models 2, 3, and 4 where only one (1) PCB per model was provided — the initial training dataset consists exclusively of GOOD (pass) reference images with no NG (defective) samples available.'
  ))
  children.push(bodyText(
    'The AI model employs a deviation-from-reference detection strategy — identifying anomalies that differ from the known-good baseline. This approach delivers reliable defect detection from day one while establishing the foundation for continuous improvement through production data.'
  ))

  children.push(heading(3, 'Production-Driven Accuracy Enhancement'))
  children.push(bodyText(
    'The AI model improves through a continuous feedback cycle between the production floor and ' + COMPANY.name + '\'s AI engineering team. This cycle operates as follows:'
  ))
  children.push(bodyText(' '))
  children.push(styledTable(
    ['Step', 'Actor', 'Action'],
    [
      ['1', 'AI System', 'Inspects PCB automatically and flags boards as PASS or NG'],
      ['2', 'Operator', 'Monitors AI results — reviews NG decisions to verify accuracy'],
      ['3', 'Operator', 'If AI NG is incorrect (false call): submits override with reason and evidence photo'],
      ['4', 'Manager', 'Reviews false call in Override Queue — approves if operator is correct'],
      ['5', 'Manager', 'Triggers Cloud Sync — approved false call data is uploaded to ' + COMPANY.name + '\'s database'],
      ['6', COMPANY.name, 'AI engineering team retrains the model using the false call data'],
      ['7', COMPANY.name, 'Deploys updated AI model back to production line via OTA update'],
      ['8', 'AI System', 'Updated model no longer makes the same false call — accuracy improves'],
    ],
    [600, 1800, 6626]
  ))
  children.push(bodyText(' '))
  children.push(bodyText(
    'This back-and-forth cycle repeats continuously throughout the stabilization period. Each iteration makes the AI smarter — reducing false call rates and improving detection precision. ' + COMPANY.name + ' will deploy a dedicated technical team on-site at the production line during the initial go-live period to accelerate this process by collecting real NG samples and performing rapid model retraining cycles.'
  ))

  children.push(heading(3, 'Projected Stabilization Timeline'))
  children.push(bodyText(
    'Based on our deployment methodology and industry experience with similar AI-powered inspection systems, we project the following maturation timeline for ' + CUSTOMER + ':'
  ))
  children.push(styledTable(
    ['Phase', 'Timeline', 'Expected Outcome', COMPANY.name + ' Support'],
    [
      ['Go-Live Baseline', 'Week 1–2', 'System operational with reference-based detection. Operators familiarize with GOOD/NG workflow. False call data collection begins.', 'On-site team at production line collecting NG samples and monitoring system performance.'],
      ['Active Data Collection', 'Week 3–6', 'First model retraining cycle with accumulated NG samples. Measurable reduction in false call rate. Detection confidence scores improve.', 'On-site AI retraining and model optimization. Regular performance reporting.'],
      ['Accuracy Stabilization', 'Month 2–3', 'AI model reaches operational maturity. False call rate drops below target threshold. Detection accuracy exceeds 95% consistently.', 'Continued on-site support. Performance validation and acceptance review.'],
      ['Ongoing Operation', 'Month 3+', 'System in steady-state operation. Periodic model updates refine accuracy further. New defect patterns automatically captured via false call workflow.', 'Remote monitoring and periodic model improvement via OTA updates.'],
    ],
    [1700, 1200, 3400, 2726]
  ))

  children.push(callout('NOTE', 'The AI accuracy stabilization timeline above represents ' + COMPANY.name + '\'s commitment to ensuring ' + CUSTOMER + ' achieves optimal inspection performance. This stabilization support is an integral part of the system delivery — it reflects the natural maturation process of the AI model as it learns from real production data. Upon completion of the stabilization period, ' + COMPANY.name + ' will continue to provide ongoing remote support, periodic model improvements, and OTA software updates as part of our long-term partnership with ' + CUSTOMER + '.'))

  // ══════════════════════════════════════════════════════════════
  // 8. ENVIRONMENTAL REQUIREMENTS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '8. Environmental Requirements'))
  children.push(styledTable(
    ['Parameter', 'Requirement'],
    [
      ['Temperature', '15°C – 35°C'],
      ['Humidity', '30% – 70% RH (non-condensing)'],
      ['Operator Illumination', '1000 – 2000 lux'],
      ['Air Pressure', '6 bar (via filter regulator)'],
      ['Power Supply', '220VAC'],
      ['PCB Flatness', 'No warpage > 2mm'],
      ['PCB Max Size', '206 × 135 mm'],
    ],
    [4513, 4513]
  ))

  // ══════════════════════════════════════════════════════════════
  // 9. PCB MODELS (PHASE 1)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '9. Supported PCB Models (Phase 1)'))
  children.push(bodyText('The system is configured for the following 4 PCB models in Phase 1:'))

  children.push(styledTable(
    ['#', 'Part Number', 'Notes'],
    [
      ['1', 'EVEQSG00800', 'Item 5 — requires UV Lamp + Cam Lamp ON'],
      ['2', 'EV10-035790-0000', 'Item 2 — Cam Lamp only (UV OFF)'],
      ['3', 'EV10-033483-0001', 'Item 3 — Cam Lamp only (UV OFF)'],
      ['4', 'EV10103-000100', 'Item 18 — requires UV Lamp + Cam Lamp ON'],
    ],
    [600, 3500, 4926]
  ))

  children.push(callout('NOTE', 'UV Lamp and Cam Lamp activation varies per part number. See Operator Manual Section 3 for DO/DON\'T reference per model.'))

  // ══════════════════════════════════════════════════════════════
  // 10. WARRANTY & SUPPORT
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '10. Warranty and Support'))

  children.push(styledTable(
    ['Item', 'Duration / Detail'],
    [
      ['Hardware Warranty', '12 months from FAT acceptance'],
      ['Software Warranty', '6 months from FAT acceptance'],
      ['Hypercare Period', '30 days post-SAT (on-site support)'],
      ['Liability Cap', '10% of contract value'],
      ['Provider', 'PT. Riyo Utama Indonesia (RUI)'],
    ],
    [3500, 5526]
  ))

  children.push(heading(2, '10.1 Warranty Exclusions'))
  children.push(bodyText('The following are NOT covered under warranty:'))
  children.push(bullet('Improper PCB handling or unauthorized modifications'))
  children.push(bullet('Operation outside specified environmental conditions'))
  children.push(bullet('Electrical surge or power supply issues'))
  children.push(bullet('Surface contamination or physical impact'))
  children.push(bullet('Unapproved software installations or network changes'))
  children.push(bullet('PCB size exceeding 206 × 135 mm'))

  children.push(heading(2, '10.2 Consumable Wear Items (Not Warranty)'))
  children.push(bullet('LED lighting — lifespan > 10,000 hours'))
  children.push(bullet('Pneumatic seal wear — periodic replacement'))
  children.push(bullet('Camera lens coating — clean per maintenance schedule'))

  // ══════════════════════════════════════════════════════════════
  // 11. ROADMAP — PHASE 2 (VISUAL EDITOR)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '11. Roadmap \u2014 Phase 2 (Visual Editor)'))
  children.push(bodyText(
    'Phase 2 of the INDUSIA AI system will introduce a Visual Editor module \u2014 a web-based tool for AI model labelling and training directly from the HMI interface.'
  ))

  children.push(heading(2, '11.1 Visual Editor Features (Phase 2)'))
  children.push(bullet('Interactive image annotation tool for labelling defect regions on captured PCB images'))
  children.push(bullet('Support for bounding box, polygon, and point annotation types'))
  children.push(bullet('Dataset management \u2014 organize training images by board model, defect type, and severity'))
  children.push(bullet('Model training pipeline \u2014 trigger AI model retraining from labelled datasets'))
  children.push(bullet('Model version management \u2014 compare accuracy between model versions before deployment'))
  children.push(bullet('Active learning \u2014 AI suggests uncertain samples for operator review to improve accuracy'))

  children.push(heading(2, '11.2 Benefits'))
  children.push(bullet('Reduced dependency on external AI training services'))
  children.push(bullet('Faster model iteration cycle \u2014 label, train, and deploy from a single interface'))
  children.push(bullet('Customer can independently improve AI accuracy for new PCB variants'))
  children.push(bullet('All training data stays on-premise for data security'))

  children.push(callout('NOTE', 'Phase 2 Visual Editor is planned as a future enhancement. Timeline and scope will be discussed separately.'))

  // ── Assemble & Save ──
  const sections = [
    coverPage('System Overview Guide', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('System Overview Guide', children),
  ]

  await buildAndSave(sections, '01_System_Overview_Guide.docx')
  console.log(`\n📊 Sections: 11 | Hardware images: ${figNum - 1} | Tables: 15`)
}

generate().catch(err => {
  console.error('❌ Generation failed:', err)
  process.exit(1)
})
