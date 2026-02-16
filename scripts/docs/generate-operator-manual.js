/**
 * Document 2: Operator Manual
 * INDUSIA AI Visual Inspection System
 *
 * Audience: Factory floor operators, technicians
 * Purpose: Step-by-step operation instructions with screenshots + hardware images
 *
 * Usage: node scripts/docs/generate-operator-manual.js "PT Customer Name"
 */

const path = require('path')
const utils = require('./doc-utils')
const {
  heading, bodyText, bullet, callout, numberedStep, styledTable,
  coverPage, revisionHistory, tableOfContents, contentSection, buildAndSave,
  embedScreenshot, screenshot, HARDWARE_IMAGES_DIR, CONTENT_WIDTH, COMPANY,
  docx: { PageBreak, Paragraph, TextRun },
} = utils

const CUSTOMER = process.argv[2] || '[Customer Name]'
const DATE = new Date().toISOString().split('T')[0]
const DOC_NUMBER = 'INDUSIA-DOC-002'

const hw = (name) => path.join(HARDWARE_IMAGES_DIR, name)
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })

async function generate() {
  console.log(`\nGenerating Operator Manual for: ${CUSTOMER}\n`)

  const children = []
  let figNum = 1

  children.push(...revisionHistory('1.0', DATE, COMPANY.name, 'Initial release'))
  children.push(...tableOfContents())

  // ══════════════════════════════════════════════════════════════
  // 1. SAFETY WARNINGS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '1. Safety Warnings'))
  children.push(callout('WARNING', 'Read all safety warnings before operating the machine.'))
  children.push(bullet('ALWAYS press the Emergency Stop (E-Stop) immediately if any unsafe condition occurs.'))
  children.push(bullet('NEVER place hands inside the inspection chamber while the machine is running.'))
  children.push(bullet('ALWAYS ensure the acrylic safety cover is properly closed before starting inspection.'))
  children.push(bullet('ALWAYS verify air pressure is at 6 bar before operating pneumatic components.'))
  children.push(bullet('NEVER disconnect power cables while the system is running.'))
  children.push(bullet('ALWAYS ensure the PCB is properly seated and locked on the pallet before pressing START.'))
  children.push(bullet('The dual START button interlock requires BOTH buttons pressed simultaneously — this ensures hands are clear of moving parts.'))

  children.push(heading(2, '1.1 Emergency Stop'))
  children.push(bodyText(
    'The Emergency Stop (E-Stop) is a red mushroom button located on the front panel. Press it firmly to immediately halt all machine operations. To reset after an E-Stop, twist the button clockwise to release, then restart the machine following the Power-On procedure.'
  ))

  // ══════════════════════════════════════════════════════════════
  // 2. MACHINE POWER-ON PROCEDURE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '2. Machine Power-On Procedure'))
  children.push(bodyText('Follow these steps in exact order to power on the inspection machine:'))

  children.push(...embedScreenshot(hw('image01.jpg'), 'Machine Front Panel — Reference for Power-On Steps', figNum++))

  children.push(heading(2, 'Step 1: Connect Power'))
  children.push(numberedStep('Connect power cable to 220VAC source. Verify the AC ONLINE lamp is ON.'))
  children.push(callout('WARNING', 'Ensure the power source is properly grounded and the voltage is stable at 220VAC.'))

  children.push(heading(2, 'Step 2: Connect Air Supply'))
  children.push(numberedStep('Connect Air Compressor to Filter Regulator. Set pressure to 6 bar.'))
  children.push(callout('NOTE', 'Check the filter regulator gauge — it must read 6 bar. Inspect for air leaks at all connections.'))

  children.push(heading(2, 'Step 3: Main Switch'))
  children.push(numberedStep('Turn Main Switch ON. Confirm POWER ON lamp is in ON condition.'))

  children.push(heading(2, 'Step 4: Activate Circuit Breakers'))
  children.push(numberedStep('Activate RCCBs and MCB 1–3 in order:'))
  children.push(styledTable(
    ['Breaker', 'Controls'],
    [
      ['RCCB', 'Activates all MCBs (master safety breaker)'],
      ['MCB 1', 'AC Extension — Cam Lamp, Camera, Display, CPU'],
      ['MCB 2', 'Fan, Box Lamp, UV Lamp'],
      ['MCB 3', 'Power Supply, Microstep Driver, PLC'],
    ],
    [2500, 6526]
  ))

  children.push(heading(2, 'Step 5: Lighting'))
  children.push(numberedStep('Turn Bench Lamp Switch ON (operator work area illumination).'))
  children.push(numberedStep('Turn Box Lamp Switch ON (internal inspection chamber illumination).'))

  children.push(heading(2, 'Step 6: UV/Cam Lamp (Part Number Dependent)'))
  children.push(numberedStep('Activate Cam Lamp and UV Lamp according to the Part Number being inspected:'))
  children.push(styledTable(
    ['Part Number', 'Cam Lamp', 'UV Lamp'],
    [
      ['EV1001100 / EVEQSG00800', 'ON', 'ON'],
      ['EV10103-000100', 'ON', 'ON'],
      ['EV10-035790-0000', 'ON', 'OFF'],
      ['EV10-033483-0001', 'ON', 'OFF'],
    ],
    [3500, 2763, 2763]
  ))
  children.push(callout('WARNING', 'Using incorrect lamp settings will cause false inspection results. Always verify the Part Number before setting lamps.'))

  // ══════════════════════════════════════════════════════════════
  // 3. PCB LOADING — DO & DON'T
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '3. PCB Loading — DO and DON\'T'))
  children.push(bodyText(
    'Proper PCB placement is critical for accurate inspection results. Follow the DO examples below for each part number. Incorrect placement will cause false inspection results.'
  ))

  children.push(...embedScreenshot(hw('image02.jpg'), 'PCB Loading Mechanism — Correct Placement', figNum++))

  children.push(heading(2, 'Step 7: Load PCB Pallet'))
  children.push(numberedStep('Load PCB Pallet onto Base Pallet and lock the PCB Pallet securely.'))

  children.push(heading(2, 'Step 8: Load PCB'))
  children.push(numberedStep('Load PCB onto PCB Pallet and lock the PCB in position.'))
  children.push(callout('WARNING', 'Ensure the PCB is flat (no warpage > 2mm) and properly oriented. Check DO/DON\'T images below for your specific Part Number.'))

  children.push(heading(2, '3.1 DO/DON\'T Reference per Part Number'))
  children.push(bodyText(
    'The following images show the CORRECT (DO) and INCORRECT (DON\'T) PCB placement for each supported Part Number. Both TOP and BOTTOM sides are shown.'
  ))

  children.push(heading(3, 'EV1001100 / EVEQSG00800'))
  children.push(...embedScreenshot(hw('image04.png'), 'DO — Correct placement (EV1001100/EVEQSG00800)', figNum++))
  children.push(...embedScreenshot(hw('image05.jpg'), 'DO — TOP Side (EV1001100/EVEQSG00800)', figNum++))
  children.push(...embedScreenshot(hw('image06.jpg'), 'DO — BOTTOM Side (EV1001100/EVEQSG00800)', figNum++))
  children.push(...embedScreenshot(hw('image07.png'), 'DON\'T — Incorrect placement (EV1001100/EVEQSG00800)', figNum++))
  children.push(...embedScreenshot(hw('image08.jpg'), 'DON\'T — TOP Side (EV1001100/EVEQSG00800)', figNum++))
  children.push(...embedScreenshot(hw('image09.jpg'), 'DON\'T — BOTTOM Side (EV1001100/EVEQSG00800)', figNum++))

  children.push(heading(3, 'EV10103-000100'))
  children.push(...embedScreenshot(hw('image10.jpg'), 'DO — TOP Side (EV10103-000100)', figNum++))
  children.push(...embedScreenshot(hw('image11.jpg'), 'DO — BOTTOM Side (EV10103-000100)', figNum++))
  children.push(...embedScreenshot(hw('image12.jpg'), 'DON\'T — TOP Side (EV10103-000100)', figNum++))
  children.push(...embedScreenshot(hw('image13.jpg'), 'DON\'T — BOTTOM Side (EV10103-000100)', figNum++))

  children.push(heading(3, 'EV10-024981-0000 / EV10-035790-0000'))
  children.push(...embedScreenshot(hw('image14.png'), 'DO — TOP Side (EV10-035790-0000)', figNum++))
  children.push(...embedScreenshot(hw('image15.png'), 'DO — BOTTOM Side (EV10-035790-0000)', figNum++))
  children.push(...embedScreenshot(hw('image16.jpg'), 'DON\'T — TOP Side (EV10-035790-0000)', figNum++))
  children.push(...embedScreenshot(hw('image17.jpg'), 'DON\'T — BOTTOM Side (EV10-035790-0000)', figNum++))

  children.push(heading(3, 'EV10-033483-0001'))
  children.push(...embedScreenshot(hw('image18.jpg'), 'DO — TOP Side (EV10-033483-0001)', figNum++))
  children.push(...embedScreenshot(hw('image19.png'), 'DO — BOTTOM Side (EV10-033483-0001)', figNum++))
  children.push(...embedScreenshot(hw('image20.jpg'), 'DON\'T — TOP Side (EV10-033483-0001)', figNum++))
  children.push(...embedScreenshot(hw('image21.jpg'), 'DON\'T — BOTTOM Side (EV10-033483-0001)', figNum++))

  // ══════════════════════════════════════════════════════════════
  // 4. START INSPECTION
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '4. Starting Inspection'))
  children.push(heading(2, 'Step 9: Press START'))
  children.push(numberedStep('Press both START buttons at the same time.'))
  children.push(callout('WARNING', 'Both START buttons MUST be pressed simultaneously. This dual-button interlock ensures operator hands are clear of moving parts.'))

  children.push(heading(2, 'Step 10: Wait for Inspection'))
  children.push(bodyText(
    'The machine will automatically perform the full inspection cycle: capture TOP → flip 180° → capture BOTTOM → AI inference → display result. The entire automated cycle takes less than 10 seconds.'
  ))

  children.push(heading(2, 'Step 11: Unload and Continue'))
  children.push(numberedStep(
    'After the inspection is complete, unload the current PCB and load the next PCB for inspection. If you want to inspect another Part Number, repeat steps 7 through 10 (and verify lamp settings in Step 6).'
  ))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 5. HMI SOFTWARE — LOGIN
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '5. HMI Software — Login'))
  children.push(bodyText('The INDUSIA AI HMI (Human-Machine Interface) is a web-based application that provides full control and monitoring of the inspection system. Access the application by opening the web browser on the built-in display.'))
  children.push(...embedScreenshot(
    screenshot(null, '0_Login_Page.png'),
    'HMI Login Page', figNum++
  ))

  children.push(numberedStep('Enter your email address in the Email field.'))
  children.push(numberedStep('Enter your password in the Password field.'))
  children.push(numberedStep('Click the Login button.'))
  children.push(callout('NOTE', 'Contact your administrator if you do not have login credentials or if your account is locked. Each user is assigned a specific role that determines which features they can access.'))

  children.push(heading(2, '5.1 Keyboard Shortcuts'))
  children.push(bodyText('The HMI supports keyboard shortcuts for faster operation during live inspection:'))
  children.push(styledTable(
    ['Key', 'Action', 'Context'],
    [
      ['G', 'Mark board as GOOD (pass)', 'Live Inspection only'],
      ['N', 'Mark board as NG (reject)', 'Live Inspection only'],
      ['?', 'Show Help Overlay', 'Any page — shows available shortcuts'],
    ],
    [1500, 4000, 3526]
  ))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 6. USER ROLES AND RESPONSIBILITIES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '6. User Roles and Responsibilities'))
  children.push(bodyText(
    'The INDUSIA AI system implements a Role-Based Access Control (RBAC) model with four distinct user roles. Each role has specific responsibilities and access to different features within the HMI. This ensures that each user has access only to the functions relevant to their daily tasks, maintaining security and operational efficiency.'
  ))

  // --- Operator ---
  children.push(heading(2, '6.1 Operator'))
  children.push(bodyText('The Operator is the primary production floor user who operates the inspection machine and monitors the AI inspection process. The AI system performs the inspection automatically — the operator\'s key role is to monitor the AI results and review any NG (defective) decisions made by the AI to determine if they are correct or false calls.', { bold: true }))
  children.push(bodyText(' '))
  children.push(bodyText('Key Responsibilities:', { bold: true }))
  children.push(bullet('Perform machine power-on and power-off procedures'))
  children.push(bullet('Load and unload PCBs onto the inspection pallet'))
  children.push(bullet('Start inspection cycles using the dual START buttons'))
  children.push(bullet('Monitor AI inspection results displayed on the HMI in real-time'))
  children.push(bullet('Review AI\'s NG decisions — determine if the board is truly defective or if the AI made a mistake (false call)'))
  children.push(bullet('Submit false call reports when the operator believes the AI\'s NG decision is incorrect'))
  children.push(bullet('Capture evidence photos for false call submissions'))
  children.push(bullet('Monitor work order progress and production counters'))
  children.push(bodyText(' '))
  children.push(bodyText('Daily Workflow:', { bold: true }))
  children.push(numberedStep('Log in to HMI with operator credentials.'))
  children.push(numberedStep('Navigate to Live Inspection → select the assigned production line.'))
  children.push(numberedStep('Select the AI model matching the Part Number to be inspected.'))
  children.push(numberedStep('Start inspection and begin loading PCBs.'))
  children.push(numberedStep('The AI inspects each board automatically and displays the result (PASS or FAIL).'))
  children.push(numberedStep('Monitor AI results — if AI marks a board as NG, review the defect image to confirm.'))
  children.push(numberedStep('If the AI\'s NG decision is correct → confirm NG. If incorrect → submit a false call with reason and optional photo.'))
  children.push(numberedStep('Continue until work order quantity is reached or shift ends.'))
  children.push(bodyText(' '))
  children.push(bodyText('Accessible Menus:', { bold: true }))
  children.push(bullet('Live Inspection — monitor AI inspection and review results'))
  children.push(bullet('Work Orders — view active work order status and counters (read-only)'))

  // --- Manager ---
  children.push(heading(2, '6.2 Manager'))
  children.push(bodyText('The Manager is the production supervisor who oversees inspection operations, reviews operator false call submissions, and plays a critical role in the AI improvement cycle. When an operator submits a false call, the manager reviews and approves or rejects it. Approved false calls are then synced to the cloud for AI model retraining.', { bold: true }))
  children.push(bodyText(' '))
  children.push(bodyText('Key Responsibilities:', { bold: true }))
  children.push(bullet('Monitor live inspection progress across all production lines in real-time'))
  children.push(bullet('Review operator false call submissions in the Override Queue — approve if the operator is correct, reject if the AI was right'))
  children.push(bullet('Trigger Cloud Sync to upload approved false call data to ' + COMPANY.name + '\'s database for AI model retraining'))
  children.push(bullet('Analyze production metrics via the Dashboard (throughput, yield, defect rates)'))
  children.push(bullet('Review sync history to confirm data integrity'))
  children.push(bullet('Monitor system health and status indicators'))
  children.push(bodyText(' '))
  children.push(bodyText('Daily Workflow:', { bold: true }))
  children.push(numberedStep('Log in to HMI with manager credentials.'))
  children.push(numberedStep('Check the Dashboard for production KPIs and trends.'))
  children.push(numberedStep('Review the Override Queue — approve or reject pending operator false call submissions.'))
  children.push(numberedStep('Monitor live inspections via the Live Inspection view (read-only monitoring mode).'))
  children.push(numberedStep('Trigger Cloud Sync to upload approved false call data and inspection results to ' + COMPANY.name + ' for AI retraining.'))
  children.push(numberedStep('Review sync history to confirm successful data transfer.'))
  children.push(bodyText(' '))
  children.push(bodyText('Accessible Menus:', { bold: true }))
  children.push(bullet('Dashboard — production analytics and KPI monitoring'))
  children.push(bullet('Live Inspection — remote monitoring of active inspections (read-only)'))
  children.push(bullet('Override Queue — review and approve/reject operator false calls'))
  children.push(bullet('Cloud Sync — upload approved false call data for AI retraining'))
  children.push(bullet('Work Orders — view work order status'))
  children.push(bullet('Event Log — audit trail of system events'))

  // --- Engineer ---
  children.push(heading(2, '6.3 Engineer'))
  children.push(bodyText('The Engineer is responsible for the technical configuration of the system. Engineers set up the organizational hierarchy (customers, sections, lines, boards) and manage work orders that drive production scheduling.', { bold: true }))
  children.push(bodyText(' '))
  children.push(bodyText('Key Responsibilities:', { bold: true }))
  children.push(bullet('Configure Master Data: register customers, define factory sections, create production lines, and set up board models with correct frame counts'))
  children.push(bullet('Create and manage Work Orders: define production batches with lot sizes, assign boards to lines'))
  children.push(bullet('Configure False Call Reasons: define the dropdown options available to operators during false call submission'))
  children.push(bullet('Monitor live inspections for technical troubleshooting'))
  children.push(bullet('Verify AI model assignments are correct for each board model'))
  children.push(bodyText(' '))
  children.push(bodyText('Daily Workflow:', { bold: true }))
  children.push(numberedStep('Log in to HMI with engineer credentials.'))
  children.push(numberedStep('Check Master Data is up-to-date (new customers, board models, lines).'))
  children.push(numberedStep('Create Work Orders for upcoming production batches.'))
  children.push(numberedStep('Activate work orders when production is ready to begin.'))
  children.push(numberedStep('Monitor inspections if technical issues arise.'))
  children.push(bodyText(' '))
  children.push(bodyText('Accessible Menus:', { bold: true }))
  children.push(bullet('Master Data — full CRUD for customers, sections, lines, boards, false call reasons'))
  children.push(bullet('Work Orders — create, edit, activate, complete, and manage work orders'))
  children.push(bullet('Live Inspection — technical monitoring'))
  children.push(bullet('Event Log — audit trail'))

  // --- Super Admin ---
  children.push(heading(2, '6.4 Super Admin'))
  children.push(bodyText('The Super Admin is the system administrator with full access to all features. Super Admins manage user accounts, configure roles and permissions, and perform system maintenance including software updates.', { bold: true }))
  children.push(bodyText(' '))
  children.push(bodyText('Key Responsibilities:', { bold: true }))
  children.push(bullet('Manage user accounts: create new users, assign roles, activate/deactivate accounts'))
  children.push(bullet('Configure roles: create custom roles with specific permission sets'))
  children.push(bullet('Manage the Permission Matrix: grant or revoke granular feature access per role'))
  children.push(bullet('Perform System Updates: check for new software versions and apply updates'))
  children.push(bullet('Full access to all Engineer and Manager features'))
  children.push(bullet('Monitor system health and resolve system-level issues'))
  children.push(bodyText(' '))
  children.push(bodyText('Accessible Menus:', { bold: true }))
  children.push(bullet('All menus accessible to Operator, Manager, and Engineer'))
  children.push(bullet('User Management — create, edit, activate/deactivate user accounts'))
  children.push(bullet('Role Management — create and configure custom roles'))
  children.push(bullet('Permission Matrix — granular permission control per role'))
  children.push(bullet('System Update — check for and install software updates'))

  // --- Feature Matrix ---
  children.push(heading(2, '6.5 Feature Access Matrix'))
  children.push(bodyText('The following table summarizes which features are accessible to each role. A checkmark (\u2713) indicates the feature is available; a dash (\u2014) indicates it is not accessible.'))
  children.push(styledTable(
    ['Feature', 'Operator', 'Manager', 'Engineer', 'Super Admin'],
    [
      ['Live Inspection — Operate & Monitor', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['Live Inspection — Monitor', '\u2014', '\u2713', '\u2713', '\u2713'],
      ['GOOD/NG Decision', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['False Call Submission', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['Override Review (Approve/Reject)', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['Dashboard & Analytics', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['Work Orders — View', '\u2713', '\u2713', '\u2713', '\u2713'],
      ['Work Orders — Create/Manage', '\u2014', '\u2014', '\u2713', '\u2713'],
      ['Master Data Management', '\u2014', '\u2014', '\u2713', '\u2713'],
      ['False Call Reasons Setup', '\u2014', '\u2014', '\u2713', '\u2713'],
      ['Cloud Sync', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['Event Log', '\u2014', '\u2713', '\u2713', '\u2713'],
      ['User Management', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['Role Management', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['Permission Matrix', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['System Update', '\u2014', '\u2014', '\u2014', '\u2713'],
    ],
    [2500, 1500, 1500, 1500, 2026]
  ))

  children.push(heading(2, '6.6 Navigation'))
  children.push(bodyText('After login, you will see the sidebar navigation menu on the left side of the screen. The sidebar displays only the menus that your role is authorized to access. Click on any menu item to navigate to that feature. The sidebar can be collapsed by clicking the toggle button at the top for a wider workspace view.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 7. HMI — LIVE INSPECTION (CRITICAL)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '7. HMI — Live Inspection'))
  children.push(bodyText('Live Inspection is the primary workflow for operators. The AI system performs the inspection automatically — the operator monitors the results and reviews any NG decisions to ensure accuracy. This section provides a detailed, step-by-step guide.'))
  children.push(callout('NOTE', 'Only operators with an active work order can perform live inspections. Managers and engineers can view the live inspection in read-only monitoring mode.'))

  children.push(heading(2, '7.1 Select Production Line'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '1_Live_view_Select_Line.png'),
    'Select Production Line', figNum++
  ))
  children.push(bodyText('The first step is to select the production line where you are working. Each production line represents a physical inspection station on the factory floor.'))
  children.push(numberedStep('Click on "Live Inspection" in the sidebar menu.'))
  children.push(numberedStep('The system displays all available production lines. Select your assigned production line by clicking on it.'))
  children.push(numberedStep('If a work order is already active on this line, the system will automatically load the work order details.'))
  children.push(callout('TIP', 'If you have previously selected a line, the system remembers your last selection and may navigate directly to the inspection view.'))

  children.push(heading(2, '7.2 Select AI Model'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '2_Live_view_Select_Model.png'),
    'Select AI Model (Board)', figNum++
  ))
  children.push(bodyText('After selecting the production line, you must choose the AI model that corresponds to the Part Number (board model) you are inspecting. The AI model defines how the system identifies defects on that specific board type.'))
  children.push(numberedStep('Select the AI model from the dropdown list. The model name corresponds to the board Part Number.'))
  children.push(numberedStep('Verify the selected model matches the physical PCB loaded on the machine.'))
  children.push(callout('WARNING', 'Always verify the AI model matches the physical Part Number loaded on the machine. Using the wrong model will produce incorrect inspection results and may cause false rejects or missed defects.'))

  children.push(heading(2, '7.3 Start Inspection'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '3_Live_view_start_inspection.png'),
    'Start Inspection View', figNum++
  ))
  children.push(bodyText('Once the production line and AI model are selected, you can start the inspection session.'))
  children.push(numberedStep('Click the "Start Inspection" button on the HMI screen.'))
  children.push(numberedStep('The system connects to the AI Backend and initializes the camera system. Wait for the "Ready" status indicator.'))
  children.push(numberedStep('Once the system is ready, press both START buttons on the machine to begin the physical inspection cycle.'))
  children.push(bodyText(' '))
  children.push(bodyText('During the inspection, the HMI displays the following information in real-time:'))
  children.push(bullet('Inspection Stage Indicator — shows the current step of the automated 20-stage inspection cycle (PCB IN → Camera Move → Capture TOP → Flip → Capture BOTTOM → AI Inspect → Result)'))
  children.push(bullet('Work Order Counters — displays completed boards, good count, and NG count'))
  children.push(bullet('Cycle Time — time elapsed for the current inspection'))
  children.push(bullet('Hardware Status — camera and PLC connection indicators'))

  children.push(heading(2, '7.4 Monitoring AI Results'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '4_Live_Inspection_Verification.png'),
    'AI Inspection Result — Operator Monitoring', figNum++
  ))
  children.push(bodyText('The AI system inspects each board automatically. After processing both TOP and BOTTOM images, the AI decision is displayed on screen. The operator monitors these results and reviews NG decisions to confirm accuracy.'))
  children.push(bodyText(' '))
  children.push(bodyText('The result screen shows:', { bold: true }))
  children.push(bullet('Board image(s) with defect bounding boxes highlighted in red (if defects are detected)'))
  children.push(bullet('AI confidence percentage — indicates how certain the AI is about its decision'))
  children.push(bullet('AI decision: PASS (no defects found) or FAIL (defects detected)'))
  children.push(bullet('Defect location markers showing exactly where the AI detected anomalies'))
  children.push(bodyText(' '))
  children.push(bodyText('As the operator, your role is to monitor and review:', { bold: true }))
  children.push(numberedStep('If the AI marks a board as PASS → the board passes automatically. Confirm by clicking GOOD (green) or pressing G.'))
  children.push(numberedStep('If the AI marks a board as NG (FAIL) → review the defect image carefully to verify the AI decision.'))
  children.push(numberedStep('If the defect is real (AI is correct) → confirm by clicking NG (red) or pressing N. The board is rejected.'))
  children.push(numberedStep('If you believe the AI is wrong (no real defect visible) → click GOOD to override. This triggers a False Call submission.'))
  children.push(callout('TIP', 'Use the keyboard shortcuts G and N for faster decision-making. This is especially useful during high-volume production runs.'))

  children.push(heading(2, '7.5 False Call Handling'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '5_Live_Inspection_Verification_by_Operator.png'),
    'False Call — Operator Override Submission', figNum++
  ))
  children.push(bodyText(
    'A "False Call" occurs when the AI marks a board as NG (defective) but the operator determines the board is actually good — the AI made a mistake. False calls are critical for improving the AI model because they provide the exact data the AI needs to learn and avoid repeating the same mistake.'
  ))
  children.push(bodyText(' '))
  children.push(bodyText('The complete False Call cycle:', { bold: true }))
  children.push(bodyText(' '))
  children.push(styledTable(
    ['Step', 'Who', 'Action'],
    [
      ['1', 'AI', 'AI inspects the board and marks it as NG (defective)'],
      ['2', 'Operator', 'Reviews the AI result and determines it is a false call (board is actually good)'],
      ['3', 'Operator', 'Clicks GOOD to override → False Call dialog appears → selects reason and submits'],
      ['4', 'Manager', 'Receives notification → reviews the false call in Override Queue → Approves or Rejects'],
      ['5', 'Manager', 'If approved: triggers Cloud Sync to upload the false call data to ' + COMPANY.name + '\'s database'],
      ['6', COMPANY.name, 'Uses the false call data to retrain the AI model with corrected patterns'],
      ['7', COMPANY.name, 'Deploys the updated AI model back to the production line via OTA update'],
      ['8', 'AI', 'Next inspection: AI recognizes the pattern and no longer makes the same false call'],
    ],
    [600, 1500, 6926]
  ))
  children.push(bodyText(' '))
  children.push(bodyText('When a false call is detected, the False Call dialog appears:', { bold: true }))
  children.push(numberedStep('The False Call dialog opens automatically when you click GOOD on a board the AI marked as NG.'))
  children.push(numberedStep('Select the appropriate reason from the dropdown list (e.g., "No defect visible", "Cosmetic only", etc.).'))
  children.push(numberedStep('Optionally, capture a photo of the actual board as evidence. This photo will be stored and sent to the manager for review.'))
  children.push(numberedStep('Click Submit to record the false call override.'))
  children.push(numberedStep('The override is sent to the manager\'s Override Queue for approval.'))
  children.push(callout('TIP', 'Always provide a reason and photo when submitting false calls. This data is sent to ' + COMPANY.name + ' for AI retraining — the more detailed your submission, the faster the AI improves. This back-and-forth cycle continues until the AI achieves optimal accuracy, typically within 90 days of production go-live.'))

  children.push(heading(2, '7.6 Auto-NG Mode'))
  children.push(...embedScreenshot(
    screenshot('7_Live_Inspection', '5_Live_Inspection_Auto-NG_Verification.png'),
    'Auto-NG Verification Mode', figNum++
  ))
  children.push(bodyText(
    'When Auto-NG mode is enabled, boards flagged as NG (defective) by the AI are automatically rejected without requiring operator confirmation. This mode is useful when the AI model has achieved high accuracy and confidence.'
  ))
  children.push(bodyText(' '))
  children.push(bodyText('In Auto-NG mode:', { bold: true }))
  children.push(bullet('AI detects PASS → operator must verify and confirm (GOOD/NG decision still required)'))
  children.push(bullet('AI detects FAIL → board is automatically marked as NG (no operator action needed)'))
  children.push(bullet('The operator can still submit a false call for auto-rejected boards if they believe the AI was wrong'))
  children.push(callout('NOTE', 'Auto-NG mode is typically enabled by the manager or engineer after the AI model has demonstrated consistent accuracy during the stabilization period.'))

  children.push(heading(2, '7.7 Multi-Frame Review'))
  children.push(bodyText(
    'When the AI detects defects on multiple frame positions of a single board, the system presents each frame for individual review. This allows the operator to assess each defect location independently.'
  ))
  children.push(bullet('The overlay shows the number of frames requiring review (e.g., "Frame 1 of 4")'))
  children.push(bullet('Use the navigation controls to move between frames'))
  children.push(bullet('Mark each frame as GOOD or NG independently'))
  children.push(bullet('After all frames are reviewed, the overall board decision is calculated automatically'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 8. HMI — WORK ORDERS
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '8. HMI — Work Order Management'))
  children.push(bodyText('Work orders define production batches and track inspection progress. Each work order is linked to a specific board model (Part Number) and production line, with a defined lot size (total boards to inspect). The system provides intelligent production tracking with the following key capabilities:'))
  children.push(bodyText(' '))
  children.push(bullet('Automatic Quantity Tracking — the HMI tracks the number of boards inspected in real-time against the work order lot size. For example, if a work order is set to 1,000 PCBs, the counters update with every inspection (completed, good, NG).'))
  children.push(bullet('Auto-Stop at Target Quantity — when the target quantity is reached (e.g., 1000/1000 boards inspected), the machine automatically stops and the work order status changes to "Completed". No manual intervention is required.'))
  children.push(bullet('On-Hold and Resume — if production needs to be interrupted mid-run to process a more urgent model, the administrator can set the current work order to "On Hold". All counters are preserved. A new work order can be created and activated for the urgent model. After the urgent run is complete, the original work order can be resumed from where it left off.'))
  children.push(bullet('Safety Interlock — the "On Hold" option is only available when the machine is NOT actively running an inspection. If the HMI detects that the machine is still in production, the On Hold status option will not appear. The operator must stop the inspection first before the work order status can be changed.'))
  children.push(bodyText(' '))
  children.push(bodyText('Only Engineers and Super Admins can create and manage work orders.'))

  children.push(heading(2, '8.1 Work Order List'))
  children.push(...embedScreenshot(
    screenshot('2_Work_Orders', '1_Work_Orders_Menu.png'),
    'Work Orders List', figNum++
  ))
  children.push(bodyText('The Work Order List displays all work orders in the system. Key information shown for each work order:'))
  children.push(bullet('Work Order Number — unique identifier (auto-generated)'))
  children.push(bullet('Customer — the customer this production batch belongs to'))
  children.push(bullet('Board Model — the Part Number being inspected'))
  children.push(bullet('Production Line — where the inspection will take place'))
  children.push(bullet('Lot Size — total number of boards to inspect'))
  children.push(bullet('Progress — completed/good/NG counters and percentage'))
  children.push(bullet('Status — current state of the work order (Draft, Ready, Active, On Hold, Completed)'))
  children.push(bodyText(' '))
  children.push(bodyText('Use the filters at the top of the page to search by work order number, customer, or status. Click on any work order row to view its details.'))

  children.push(heading(2, '8.2 Creating a Work Order'))
  children.push(...embedScreenshot(
    screenshot('2_Work_Orders', '2_create_work_order_form.png'),
    'Create Work Order Form', figNum++
  ))
  children.push(bodyText('To create a new work order, follow these steps:'))
  children.push(numberedStep('Click the "Create Work Order" button at the top of the Work Orders page.'))
  children.push(numberedStep('Select the Customer from the dropdown. Only customers registered in Master Data are available.'))
  children.push(numberedStep('Select the Section (factory area) where this production will occur.'))
  children.push(numberedStep('Select the Production Line within that section.'))
  children.push(numberedStep('Select the Board Model (Part Number) to be inspected. This determines which AI model will be used.'))
  children.push(numberedStep('Enter the Lot Size — the total number of boards to be inspected in this batch.'))
  children.push(numberedStep('Click Create to save the work order. It will be created in "Draft" status.'))
  children.push(callout('NOTE', 'All fields are required. The Board Model must be registered in Master Data before it can be selected in a work order. Contact your Engineer if a board model is missing.'))

  children.push(heading(2, '8.3 Work Order Status Flow'))
  children.push(...embedScreenshot(
    screenshot('2_Work_Orders', '3_wo_active_status_on_hold_completed.png'),
    'Work Order Status: Active, On Hold, Completed', figNum++
  ))
  children.push(bodyText('A work order progresses through the following status lifecycle:'))
  children.push(styledTable(
    ['Status', 'Description', 'Who Can Change'],
    [
      ['Draft', 'Work order has been created but not yet reviewed or activated. Can be edited freely.', 'Engineer, Super Admin'],
      ['Ready', 'Work order has been reviewed and is ready to start production. Waiting for operator to begin.', 'Engineer, Super Admin'],
      ['Active', 'Production is in progress. Inspection counters (completed, good, NG) are being tracked in real-time. When the lot size target is reached, the system auto-stops the machine and auto-completes the work order.', 'Engineer, Super Admin'],
      ['On Hold', 'Production is temporarily paused to prioritize another model. All counters are preserved and production can be resumed at any time. IMPORTANT: The On Hold option is only available when the machine is NOT running — the system blocks this status change while an active inspection is in progress.', 'Engineer, Super Admin'],
      ['Completed', 'All boards have been inspected (auto-completed at target quantity), or the work order has been manually completed. Counters are final.', 'Engineer, Super Admin'],
    ],
    [1500, 4800, 2726]
  ))
  children.push(callout('TIP', 'Only one work order can be Active per production line at a time. To switch to a different model mid-production: (1) stop the inspection, (2) set the current work order to On Hold, (3) create and activate a new work order for the urgent model. After the urgent run is complete, resume the original work order.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 9. HMI — OVERRIDE QUEUE (MANAGER)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '9. HMI — Override Queue (Manager)'))
  children.push(bodyText('The Override Queue is where managers review false call submissions from operators. Each override represents a case where the AI flagged a board as NG, but the operator determined it was actually good. The manager must review the evidence and either approve (operator is correct, AI made a mistake) or reject (AI was correct) the override.'))
  children.push(bodyText(' '))
  children.push(bodyText('Approved overrides play a critical role in AI improvement: once approved and synced to the cloud, ' + COMPANY.name + ' uses this data to retrain the AI model so it no longer makes the same mistake. The updated model is then deployed back to the production line.'))
  children.push(callout('NOTE', 'Only Managers and Super Admins have access to the Override Queue.'))

  children.push(heading(2, '9.1 Override List'))
  children.push(...embedScreenshot(
    screenshot('8_Overdue_Queue_Menu', '1_Overdue_Queue_Menu.png'),
    'Override Review Queue — Pending Submissions', figNum++
  ))
  children.push(bodyText('The Override Queue displays all pending false call submissions. For each override, the following information is shown:'))
  children.push(bullet('Submission Date/Time — when the operator submitted the override'))
  children.push(bullet('Operator Name — who submitted the false call'))
  children.push(bullet('Board Model — the Part Number that was inspected'))
  children.push(bullet('Override Type — False Positive (AI said FAIL, operator said GOOD) or False Negative (AI said PASS, operator said NG)'))
  children.push(bullet('Reason — the reason selected by the operator'))
  children.push(bullet('Evidence Image — photo captured by the operator (if provided)'))
  children.push(bullet('Status — Pending, Approved, or Rejected'))
  children.push(bodyText(' '))
  children.push(bodyText('Use the filters to narrow results by date range, operator, board model, or status.'))

  children.push(heading(2, '9.2 Reviewing an Override'))
  children.push(...embedScreenshot(
    screenshot('8_Overdue_Queue_Menu', '1_Overdue_Queue_Approve_Reject.png'),
    'Override Detail — Approve or Reject', figNum++
  ))
  children.push(bodyText('To review an override submission:'))
  children.push(numberedStep('Click on a pending override in the list to open the detail view.'))
  children.push(numberedStep('Review the AI inspection image — examine the areas where defects were (or were not) detected.'))
  children.push(numberedStep('Review the operator\'s evidence photo (if available) — compare with the AI image.'))
  children.push(numberedStep('Read the operator\'s selected reason for the override.'))
  children.push(numberedStep('Make your decision:'))
  children.push(bullet('Click Approve if you agree with the operator\'s assessment. The override will be marked as "Approved" and used as training data for the AI model.'))
  children.push(bullet('Click Reject if you believe the AI decision was correct. The override will be marked as "Rejected".'))
  children.push(callout('TIP', 'Approved overrides are particularly valuable for AI improvement. When false positives are approved, the AI learns to avoid flagging similar patterns as defects in future inspections. Review overrides promptly to accelerate AI learning.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 10. HMI — DASHBOARD (MANAGER)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '10. HMI — Dashboard (Manager)'))
  children.push(bodyText('The Dashboard provides real-time analytics and Key Performance Indicators (KPIs) for production monitoring. Managers can use the Dashboard to track production efficiency, defect trends, and overall inspection performance.'))
  children.push(bodyText(' '))
  children.push(bodyText('Key metrics displayed on the Dashboard:', { bold: true }))
  children.push(bullet('Total Inspections — number of boards inspected within the selected period'))
  children.push(bullet('Pass Rate / Yield — percentage of boards that passed inspection'))
  children.push(bullet('NG Rate — percentage of boards flagged as defective'))
  children.push(bullet('False Call Rate — percentage of inspections where operator and AI disagreed'))
  children.push(bullet('Throughput — boards inspected per hour'))
  children.push(bullet('Trend Charts — historical graphs showing inspection volume and quality trends over time'))
  children.push(callout('NOTE', 'Dashboard data is based on inspection results stored in the local database. For the most current data, ensure Cloud Sync is performed regularly.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 11. HMI — CLOUD SYNC (MANAGER)
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '11. HMI — Cloud Sync (Manager)'))
  children.push(bodyText('Cloud Sync uploads approved false call data and inspection results from the local edge database to ' + COMPANY.name + '\'s cloud database. This is the critical mechanism that enables AI model improvement:'))
  children.push(bullet('AI Model Retraining — approved false call data (including images and operator corrections) is sent to ' + COMPANY.name + ' for AI model retraining. ' + COMPANY.name + ' uses this data to build an improved model and deploys it back to the production line via OTA update.'))
  children.push(bullet('Continuous Improvement Cycle — each sync delivers new training data, each retrained model reduces false calls. This cycle continues until the AI achieves optimal accuracy (typically within 90 days).'))
  children.push(bullet('Centralized Analytics — production data from all machines can be aggregated in the cloud for reporting'))
  children.push(bullet('Data Backup — cloud storage provides an off-site backup of all inspection records'))

  children.push(heading(2, '11.1 Sync Dashboard'))
  children.push(...embedScreenshot(
    screenshot('9_Sync_to_Cloud_Menu', '1_Sync_to_Cloud_Menu.png'),
    'Cloud Sync Dashboard', figNum++
  ))
  children.push(bodyText('The Sync Dashboard shows the current synchronization status:'))
  children.push(bullet('Last Sync Time — when the most recent sync was completed'))
  children.push(bullet('Pending Records — number of inspection records waiting to be uploaded'))
  children.push(bullet('Sync Status — current state (Idle, In Progress, Failed)'))
  children.push(bullet('Internet Connectivity — shows whether the cloud server is reachable'))

  children.push(heading(2, '11.2 Manual Sync'))
  children.push(...embedScreenshot(
    screenshot('9_Sync_to_Cloud_Menu', '2_Sync_to_Cloud_in_progress_modal.png'),
    'Sync in Progress', figNum++
  ))
  children.push(bodyText('To manually trigger a synchronization:'))
  children.push(numberedStep('Click the "Sync Now" button to start the synchronization process.'))
  children.push(numberedStep('A progress dialog will appear showing real-time upload progress.'))
  children.push(numberedStep('Wait for the sync to complete. The dialog will show the number of records synced and any errors encountered.'))
  children.push(numberedStep('Once complete, verify the sync was successful by checking the "Last Sync" timestamp and reviewing any error messages.'))
  children.push(callout('NOTE', 'Synchronization requires an active internet connection. If the connection is unstable, the sync will retry automatically. Large datasets may take several minutes to upload.'))

  children.push(heading(2, '11.3 Sync History'))
  children.push(...embedScreenshot(
    screenshot('9_Sync_to_Cloud_Menu', '3_Sync_to_Cloud_History.png'),
    'Sync History — Session Overview', figNum++
  ))
  children.push(bodyText('The Sync History section displays a log of all previous synchronization sessions. For each session, the following information is shown:'))
  children.push(bullet('Session Date/Time — when the sync was initiated'))
  children.push(bullet('Duration — how long the sync took'))
  children.push(bullet('Records Synced — total number of records uploaded successfully'))
  children.push(bullet('Failed Records — number of records that failed to sync (if any)'))
  children.push(bullet('Status — Completed, Partial, or Failed'))

  children.push(heading(2, '11.4 Sync Detail'))
  children.push(...embedScreenshot(
    screenshot('9_Sync_to_Cloud_Menu', '4_Sync_History_Detail.png'),
    'Sync History — Detail View', figNum++
  ))
  children.push(bodyText('Click on any sync session row to view detailed information, including:'))
  children.push(bullet('Breakdown of records synced per table (inspection results, defects, overrides, images)'))
  children.push(bullet('Error details for any failed records'))
  children.push(bullet('Total data transferred'))
  children.push(callout('TIP', 'If a sync session shows failed records, click on the detail view to identify the cause. Common issues include network interruptions or large image files. Failed records will be retried in the next sync session.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 12. HMI — ADMINISTRATION
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '12. HMI — Administration'))
  children.push(bodyText('The Administration section provides configuration and management tools for the INDUSIA AI system. Access to these features is restricted based on user role.'))
  children.push(callout('NOTE', 'Master Data is accessible to Engineers and Super Admins. User Management, Role Management, Permission Matrix, and System Update are accessible to Super Admins only.'))

  // ─── 12.1 Master Data ───
  children.push(heading(2, '12.1 Master Data Management'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '1_master_data_menu.png'),
    'Master Data — Tab Navigation', figNum++
  ))
  children.push(bodyText(
    'Master Data defines the organizational hierarchy of your factory within the INDUSIA AI system. The hierarchy follows this structure: Customer → Section → Production Line → Board Model. All data must be set up correctly before work orders can be created and inspections can begin.'
  ))
  children.push(bodyText('The Master Data page uses a tabbed interface with five tabs: Customers, Sections, Lines, Board Models, and False Call Reasons. Click on any tab to manage that data type.'))

  // Customers
  children.push(heading(3, '12.1.1 Customers'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '2_master_data_customer_menu.png'),
    'Customer Management', figNum++
  ))
  children.push(bodyText('Customers represent the companies that own the PCBs being inspected. Each customer can have multiple factory sections.'))
  children.push(bodyText(' '))
  children.push(bodyText('Customer fields:', { bold: true }))
  children.push(bullet('Customer Name — the official company name'))
  children.push(bullet('Customer Code — a short code for identification (e.g., "PCIE")'))
  children.push(bullet('Status — Active or Inactive'))
  children.push(bodyText(' '))
  children.push(bodyText('Actions available:', { bold: true }))
  children.push(bullet('Add Customer — click the "Add" button, fill in the form, and save'))
  children.push(bullet('Edit Customer — click the edit icon on any customer row to modify details'))
  children.push(bullet('Deactivate Customer — set status to Inactive (data is preserved, not deleted)'))

  // Sections
  children.push(heading(3, '12.1.2 Sections'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '3_master_data_section_menu.png'),
    'Section Management', figNum++
  ))
  children.push(bodyText('Sections represent physical factory areas or departments (e.g., SMT, THT, Final Assembly). Each section belongs to a customer and can contain multiple production lines.'))
  children.push(bodyText(' '))
  children.push(bodyText('Section fields:', { bold: true }))
  children.push(bullet('Section Name — descriptive name of the factory area'))
  children.push(bullet('Section Code — short code for identification'))
  children.push(bullet('Customer — the customer this section belongs to'))
  children.push(bullet('Status — Active or Inactive'))
  children.push(bodyText(' '))
  children.push(bodyText('Actions: Add, Edit, and Deactivate (same pattern as Customers).'))

  // Lines
  children.push(heading(3, '12.1.3 Production Lines'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '4_master_data_production_line_menu.png'),
    'Production Line Management', figNum++
  ))
  children.push(bodyText('Production Lines represent individual inspection stations within a section. Each production line is where the physical INDUSIA AI machine is installed.'))
  children.push(bodyText(' '))
  children.push(bodyText('Production Line fields:', { bold: true }))
  children.push(bullet('Line Name — descriptive name (e.g., "Line 1", "SMT-AOI-01")'))
  children.push(bullet('Line Code — short code for identification'))
  children.push(bullet('Section — the section this line belongs to'))
  children.push(bullet('Status — Active or Inactive'))
  children.push(bodyText(' '))
  children.push(bodyText('Actions: Add, Edit, and Deactivate.'))
  children.push(callout('NOTE', 'Each INDUSIA AI machine should be mapped to one production line. The production line is used to link work orders and inspection results to a specific machine.'))

  // Board Models
  children.push(heading(3, '12.1.4 Board Models'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '5_master_data_board_model_menu.png'),
    'Board Model Management', figNum++
  ))
  children.push(bodyText('Board Models represent the different PCB types (Part Numbers) that can be inspected. Each board model is linked to a specific AI model that has been trained to detect defects on that board type.'))
  children.push(bodyText(' '))
  children.push(bodyText('Board Model fields:', { bold: true }))
  children.push(bullet('Board Name — the Part Number or model identifier'))
  children.push(bullet('Customer — the customer this board belongs to'))
  children.push(bullet('Top Frame Count — number of camera capture frames for the TOP side'))
  children.push(bullet('Bottom Frame Count — number of camera capture frames for the BOTTOM side'))
  children.push(bullet('Description — optional notes about the board'))
  children.push(bullet('Status — Active or Inactive'))
  children.push(bodyText(' '))
  children.push(callout('WARNING', 'The Top Frame Count and Bottom Frame Count must be configured correctly. These values determine how many image captures the AI system takes per side. Incorrect values will cause inspection errors or incomplete coverage.'))

  // False Call Reasons
  children.push(heading(3, '12.1.5 False Call Reasons'))
  children.push(...embedScreenshot(
    screenshot('1_Master_data', '6_master_data_false_call_reason_menu.png'),
    'False Call Reason Management', figNum++
  ))
  children.push(bodyText('False Call Reasons define the dropdown options available to operators when submitting a false call during live inspection. These reasons categorize why the operator disagrees with the AI decision.'))
  children.push(bodyText(' '))
  children.push(bodyText('Examples of common false call reasons:', { bold: true }))
  children.push(bullet('No defect visible — AI flagged a defect but operator sees none (false positive)'))
  children.push(bullet('Solder bridge — operator sees a solder bridge that AI missed (false negative)'))
  children.push(bullet('Missing component — operator sees a missing component that AI missed'))
  children.push(bullet('Cosmetic only — AI flagged a cosmetic issue that does not affect function'))
  children.push(bullet('Board contamination — foreign material detected by AI but not a defect'))
  children.push(bodyText(' '))
  children.push(bodyText('Actions: Add new reasons, Edit existing reasons, Deactivate reasons no longer needed.'))
  children.push(callout('TIP', 'Keep the false call reason list concise and relevant. Too many options slow down the operator workflow. Review and update the list periodically based on production experience.'))

  children.push(pageBreak())

  // ─── 12.2 User Management ───
  children.push(heading(2, '12.2 User Management'))
  children.push(bodyText('User Management allows Super Admins to create and manage user accounts. Each user account has an email, password, assigned role, and section access.'))

  children.push(heading(3, '12.2.1 User List'))
  children.push(...embedScreenshot(
    screenshot('3_User_managements', '1_user_management_menu.png'),
    'User Management — User List', figNum++
  ))
  children.push(bodyText('The User List displays all user accounts in the system. Information shown for each user:'))
  children.push(bullet('Name — full name of the user'))
  children.push(bullet('Email — login email address'))
  children.push(bullet('Role — assigned role (Operator, Manager, Engineer, Super Admin)'))
  children.push(bullet('Section Access — which factory sections the user can access'))
  children.push(bullet('Status — Active or Inactive'))
  children.push(bullet('Last Login — date and time of the user\'s most recent login'))

  children.push(heading(3, '12.2.2 Adding a New User'))
  children.push(...embedScreenshot(
    screenshot('3_User_managements', '4_user_management_Add_Form.png'),
    'Add New User Form', figNum++
  ))
  children.push(bodyText('To create a new user account:'))
  children.push(numberedStep('Click the "Add User" button.'))
  children.push(numberedStep('Enter the user\'s full name.'))
  children.push(numberedStep('Enter a unique email address (used as login ID).'))
  children.push(numberedStep('Set an initial password. The user should change this on first login.'))
  children.push(numberedStep('Select the user\'s role from the dropdown (Operator, Manager, Engineer, Super Admin).'))
  children.push(numberedStep('Assign section access — select which factory sections this user can access.'))
  children.push(numberedStep('Click Save to create the account.'))
  children.push(callout('NOTE', 'Each email address can only be used once. If a user needs to be re-created, deactivate the old account first.'))

  children.push(heading(3, '12.2.3 Editing a User'))
  children.push(...embedScreenshot(
    screenshot('3_User_managements', '3_user_management_Edit_Form.png'),
    'Edit User Form', figNum++
  ))
  children.push(bodyText('To modify an existing user account, click the edit icon on the user row. You can update the user\'s name, role, section access, and status. The email address cannot be changed after creation.'))

  children.push(heading(3, '12.2.4 User Actions'))
  children.push(...embedScreenshot(
    screenshot('3_User_managements', '2_user_management_action.png'),
    'User Actions — Edit, Deactivate', figNum++
  ))
  children.push(bodyText('Available actions for each user:'))
  children.push(bullet('Edit — modify user details (name, role, section access)'))
  children.push(bullet('Deactivate — disable the user account. The user will no longer be able to log in. Data associated with the user is preserved.'))
  children.push(bullet('Activate — re-enable a previously deactivated account'))
  children.push(callout('WARNING', 'Deactivating a user immediately prevents them from logging in. Any active inspection session by that user will not be interrupted but they cannot start new sessions.'))

  children.push(pageBreak())

  // ─── 12.3 Role Management ───
  children.push(heading(2, '12.3 Role Management'))
  children.push(bodyText('Role Management allows Super Admins to create and configure user roles. Each role defines a set of permissions that determine what features users with that role can access.'))

  children.push(heading(3, '12.3.1 Role List'))
  children.push(...embedScreenshot(
    screenshot('4_Role_Managements', '1_role_management_menu.png'),
    'Role Management — Role List', figNum++
  ))
  children.push(bodyText('The system comes with four predefined roles: Operator, Manager, Engineer, and Super Admin. You can create additional custom roles if your organization requires more granular access control.'))
  children.push(bodyText(' '))
  children.push(bodyText('Information shown for each role:'))
  children.push(bullet('Role Name — descriptive name of the role'))
  children.push(bullet('Description — brief description of the role\'s purpose'))
  children.push(bullet('Users Count — number of users currently assigned to this role'))
  children.push(bullet('Permissions — number of permissions granted to this role'))

  children.push(heading(3, '12.3.2 Adding a New Role'))
  children.push(...embedScreenshot(
    screenshot('4_Role_Managements', '3_role_management_Add_New_Role_Form.png'),
    'Add New Role Form', figNum++
  ))
  children.push(bodyText('To create a new custom role:'))
  children.push(numberedStep('Click the "Add Role" button.'))
  children.push(numberedStep('Enter a role name (e.g., "Shift Supervisor", "QC Inspector").'))
  children.push(numberedStep('Enter a description explaining the role\'s purpose.'))
  children.push(numberedStep('Click Save. The role will be created with no permissions — use the Permission Matrix to grant access.'))

  children.push(heading(3, '12.3.3 Editing a Role'))
  children.push(...embedScreenshot(
    screenshot('4_Role_Managements', '2_role_management_Edit_Role_Form.png'),
    'Edit Role Form', figNum++
  ))
  children.push(bodyText('Click the edit icon on any role to modify its name or description. To change the permissions associated with a role, use the Permission Matrix (Section 12.4).'))
  children.push(callout('WARNING', 'Modifying a predefined role (Operator, Manager, Engineer, Super Admin) affects all users assigned to that role. Changes take effect immediately on the next page load.'))

  children.push(pageBreak())

  // ─── 12.4 Permission Matrix ───
  children.push(heading(2, '12.4 Permission Matrix'))
  children.push(bodyText('The Permission Matrix provides granular control over which features each role can access. It displays a grid where rows represent features/menus and columns represent roles. Super Admins can grant or revoke individual permissions by toggling the checkboxes.'))

  children.push(heading(3, '12.4.1 Permission Grid'))
  children.push(...embedScreenshot(
    screenshot('5_Permission_Matrix', '1_Permission_Matrix_Menu.png'),
    'Permission Matrix — Overview', figNum++
  ))
  children.push(bodyText('The Permission Matrix shows all available system features as rows and all roles as columns. Each intersection has a checkbox:'))
  children.push(bullet('Checked (enabled) — users with this role CAN access this feature'))
  children.push(bullet('Unchecked (disabled) — users with this role CANNOT access this feature'))

  children.push(heading(3, '12.4.2 Granting/Revoking Permissions'))
  children.push(...embedScreenshot(
    screenshot('5_Permission_Matrix', '2_Permission_Matrix_grant_revoke_action.png'),
    'Grant/Revoke Permissions', figNum++
  ))
  children.push(bodyText('To modify permissions:'))
  children.push(numberedStep('Locate the feature (row) you want to modify.'))
  children.push(numberedStep('Find the role (column) you want to grant or revoke access for.'))
  children.push(numberedStep('Click the checkbox at the intersection to toggle the permission.'))
  children.push(numberedStep('Changes are saved automatically. The affected users will see the updated menu on their next page load.'))
  children.push(callout('WARNING', 'Be careful when modifying permissions for the Super Admin role. Removing critical permissions from Super Admin could lock you out of administrative functions.'))

  children.push(pageBreak())

  // ─── 12.5 System Update ───
  children.push(heading(2, '12.5 System Update'))
  children.push(...embedScreenshot(
    screenshot('6_System_Update', '1_System_Update_Menu.png'),
    'System Update — Check for Updates', figNum++
  ))
  children.push(bodyText('The System Update feature allows Super Admins to independently check for and install software updates for the INDUSIA AI system — no external technical support is required. The admin can perform the entire update process directly from the HMI interface. Updates may include new features, performance improvements, bug fixes, and AI model enhancements.'))
  children.push(bodyText(' '))
  children.push(bodyText('Update process:', { bold: true }))
  children.push(numberedStep('The system automatically checks for available updates periodically. A notification badge appears in the top navigation bar when an update is available.'))
  children.push(numberedStep('Navigate to the System Update page to view update details, including version number and change description.'))
  children.push(numberedStep('Review the preflight checks — the system verifies that no production lines are actively running inspections before proceeding.'))
  children.push(numberedStep('Click "Install Update" to begin the update process. A terminal-style progress display shows each step in real-time.'))
  children.push(numberedStep('The system will automatically download, install, apply any database migrations, and restart. This process typically takes 2–5 minutes.'))
  children.push(numberedStep('After restart, log in again and verify the new version is displayed in the top navigation bar.'))
  children.push(callout('WARNING', 'Do NOT shut down the machine or close the browser during the update process. Interrupting the update may leave the system in an inconsistent state. Ensure all production is stopped before installing updates.'))

  // ─── 12.6 Event Log ───
  children.push(heading(2, '12.6 Event Log'))
  children.push(bodyText('The Event Log provides a complete audit trail of all system activities. Every significant action is recorded with a timestamp, the user who performed it, and relevant details.'))
  children.push(bodyText(' '))
  children.push(bodyText('Events tracked include:', { bold: true }))
  children.push(bullet('User login and logout'))
  children.push(bullet('Override submissions (false calls by operators)'))
  children.push(bullet('Override reviews (approve/reject by managers)'))
  children.push(bullet('Cloud sync start and completion'))
  children.push(bullet('Work order status changes'))
  children.push(bullet('System updates'))
  children.push(bullet('User account changes'))
  children.push(bodyText(' '))
  children.push(bodyText('Use the filters at the top of the Event Log page to search by event type, user, date range, or keyword. Events can be exported to CSV format for external analysis.'))

  children.push(pageBreak())

  // ══════════════════════════════════════════════════════════════
  // 13. POWER-OFF PROCEDURE
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, '13. Power-Off Procedure'))
  children.push(bodyText('Follow these steps in reverse order to safely shut down the machine:'))
  children.push(numberedStep('Ensure no inspection is in progress. Complete or stop any active work order.'))
  children.push(numberedStep('Log out of the HMI application.'))
  children.push(numberedStep('Turn OFF UV Lamp and Cam Lamp switches.'))
  children.push(numberedStep('Turn OFF Box Lamp switch.'))
  children.push(numberedStep('Turn OFF Bench Lamp switch.'))
  children.push(numberedStep('Deactivate MCB 3, MCB 2, MCB 1, then RCCB (reverse order of activation).'))
  children.push(numberedStep('Turn Main Switch to OFF position.'))
  children.push(numberedStep('Disconnect air compressor if needed.'))
  children.push(callout('NOTE', 'The CPU (edge device) will shut down automatically when MCB 1 is turned off. Allow 10 seconds for the system to complete shutdown before disconnecting power.'))

  // ══════════════════════════════════════════════════════════════
  // APPENDICES
  // ══════════════════════════════════════════════════════════════
  children.push(heading(1, 'Appendix A: Keyboard Shortcuts'))
  children.push(styledTable(
    ['Key', 'Action', 'Available On'],
    [
      ['G', 'Mark board as GOOD (pass)', 'Live Inspection'],
      ['N', 'Mark board as NG (reject)', 'Live Inspection'],
      ['?', 'Toggle Help Overlay', 'All pages'],
    ],
    [1500, 4000, 3526]
  ))

  children.push(heading(1, 'Appendix B: Glossary'))
  children.push(styledTable(
    ['Term', 'Definition'],
    [
      ['HMI', 'Human-Machine Interface — the web-based control panel for operating the inspection system'],
      ['PCB', 'Printed Circuit Board — the electronic board being inspected'],
      ['AI', 'Artificial Intelligence — the deep learning model that automatically detects defects'],
      ['NG', 'No Good — a board that has been identified as defective'],
      ['GOOD / PASS', 'A board that has been identified as free of defects'],
      ['False Call', 'A disagreement between the operator and the AI decision'],
      ['False Positive', 'AI incorrectly flags a good board as defective'],
      ['False Negative', 'AI incorrectly passes a defective board as good'],
      ['Override', 'An operator submission when they disagree with the AI decision'],
      ['Work Order', 'A production batch defining the board model, line, and quantity to inspect'],
      ['Lot Size', 'The total number of boards to be inspected in a work order'],
      ['Master Data', 'Configuration data: customers, sections, production lines, and board models'],
      ['Cloud Sync', 'The process of uploading local inspection data to the cloud server'],
      ['DDR', 'Defect Detection Rate — percentage of actual defects correctly identified by AI'],
      ['FCR', 'False Call Rate — percentage of inspections where operator and AI disagree'],
      ['FPY', 'First Pass Yield — percentage of boards passing inspection on the first attempt'],
      ['PLC', 'Programmable Logic Controller — industrial controller managing machine automation'],
      ['SSE', 'Server-Sent Events — real-time data streaming from AI backend to HMI'],
      ['E-Stop', 'Emergency Stop — red button that immediately halts all machine operations'],
      ['OTA', 'Over-The-Air — remote software update capability'],
    ],
    [2000, 7026]
  ))

  children.push(heading(1, 'Appendix C: Role-Permission Summary'))
  children.push(styledTable(
    ['Feature', 'Operator', 'Manager', 'Engineer', 'Super Admin'],
    [
      ['Live Inspection — Operate & Monitor', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['Live Inspection — Monitor', '\u2014', '\u2713', '\u2713', '\u2713'],
      ['GOOD/NG Decision', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['False Call Submit', '\u2713', '\u2014', '\u2014', '\u2014'],
      ['Override Review', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['Dashboard & Analytics', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['Work Orders (View)', '\u2713', '\u2713', '\u2713', '\u2713'],
      ['Work Orders (Create)', '\u2014', '\u2014', '\u2713', '\u2713'],
      ['Master Data', '\u2014', '\u2014', '\u2713', '\u2713'],
      ['Cloud Sync', '\u2014', '\u2713', '\u2014', '\u2713'],
      ['User Management', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['Role Management', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['Permissions', '\u2014', '\u2014', '\u2014', '\u2713'],
      ['System Update', '\u2014', '\u2014', '\u2014', '\u2713'],
    ],
    [2200, 1500, 1700, 1700, 1926]
  ))

  // ── Assemble & Save ──
  const sections = [
    coverPage('Operator Manual', DOC_NUMBER, CUSTOMER, DATE),
    contentSection('Operator Manual', children),
  ]

  await buildAndSave(sections, '02_Operator_Manual.docx')
  console.log(`\n\ud83d\udcca Figures: ${figNum - 1} (HMI screenshots + hardware images)`)
}

generate().catch(err => {
  console.error('\u274c Generation failed:', err)
  process.exit(1)
})
