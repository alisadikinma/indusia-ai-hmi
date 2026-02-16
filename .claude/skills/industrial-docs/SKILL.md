# Industrial Documentation Generator — INDUSIA AI

> **Purpose:** Generate 6 professional delivery documents for INDUSIA AI Visual Inspection System  
> **Output:** `.docx` files with embedded screenshots, diagrams, and hardware images  
> **Target:** Customer delivery package for FAT/SAT handover

---

## Overview

This skill generates the complete documentation package for delivering the INDUSIA AI PCB Visual Inspection system to customers. All documents are in English, professional formatting, and include embedded screenshots from the HMI system.

### Documents to Generate

| # | Document | Filename | Pages (est.) |
|---|----------|----------|-------------|
| 1 | System Architecture Guide | `01_System_Architecture_Guide.docx` | 15-20 |
| 2 | Operator Manual | `02_Operator_Manual.docx` | 25-35 |
| 3 | Maintenance Manual | `03_Maintenance_Manual.docx` | 10-15 |
| 4 | Troubleshooting Guide | `04_Troubleshooting_Guide.docx` | 10-15 |
| 5 | FAT Report | `05_FAT_Report.docx` | 8-12 |
| 6 | SAT Report | `06_SAT_Report.docx` | 8-12 |

---

## Asset Locations

### Screenshots (HMI Software)

```
docs/FAT_SAT/Operation_Manual/
├── Login_Page.png
├── 1_Master_data/          → 6 screenshots (menu, customer, section, line, board, false call)
├── 2_Work_Orders/          → 3 screenshots (menu, create form, status)
├── 3_User_managements/     → 4 screenshots (menu, action, edit, add)
├── 4_Role_Managements/     → 3 screenshots (menu, edit, add)
├── 5_Permission_Matrix/    → 2 screenshots (menu, grant/revoke)
├── 6_System_Update/        → 1 screenshot (menu)
├── 7_Live_Inspection/      → 6 screenshots (select line/model, start, verification, auto-NG, operator)
├── 8_Overdue_Queue_Menu/   → 2 screenshots (menu, approve/reject)
└── 9_Sync_to_Cloud_Menu/   → 4 screenshots (menu, progress, history, detail)
```

### Hardware Documentation

```
docs/FAT_SAT/
├── manual book (english version).docx    → Machine overview, component table, DO/DON'T images
├── Overview Mechanical.docx              → Mechanical diagrams with numbered callouts
```

### Hardware Images in Manual Book

The existing manual book contains these critical images (extract via unpack):
- `image1.jpg` — Machine overview (front view with numbered callouts: Display, CPU, Pass/Fail lamp, E-Stop, UV/Cam/Bench/Box lamps, PB START, AC ONLINE, POWER ON, Filter Regulator, Main Switch)
- `image2.png` — PCB loading mechanism (Cylinder, PCB, Pallet, Base Pallet, Base Jig)
- `image3.png` — Camera chamber (Box Lamp, Linear roller bracket, UV Lamp, Camera, Cam Lamp)
- `image4-19.jpg` — PCB DO/DON'T reference images per part number

### Technical References (Project Docs)

```
docs/
├── API_AI_BACKEND.md       → AI Backend API contract (33+ endpoints, SSE events)
├── API_DOCUMENTATION.md    → Internal UI API documentation
├── DATABASE_SCHEMA.md      → Full database schema + ownership matrix
└── swagger/ai-backend-api.yaml → OpenAPI spec
```

---

## Document Generation Workflow

### Pre-requisites

```bash
npm install -g docx
```

### Step-by-Step Process

For EACH document:

1. **Read this SKILL.md** for outline and content requirements
2. **Read the relevant template** from `templates/` directory (sibling of this file)
3. **Gather assets:**
   - Copy needed screenshots from `docs/FAT_SAT/Operation_Manual/`
   - Extract hardware images from existing `.docx` files if needed
   - Read technical docs for accurate system specifications
4. **Generate `.docx`** using `docx-js` (Node.js library)
5. **Validate** the output file
6. **Save** to `docs/FAT_SAT/deliverables/`

### Output Directory

```
docs/FAT_SAT/deliverables/
├── 01_System_Architecture_Guide.docx
├── 02_Operator_Manual.docx
├── 03_Maintenance_Manual.docx
├── 04_Troubleshooting_Guide.docx
├── 05_FAT_Report.docx
└── 06_SAT_Report.docx
```

---

## Document Standards

### Formatting

| Element | Spec |
|---------|------|
| Paper Size | A4 (11906 x 16838 DXA) |
| Margins | 1 inch all sides (1440 DXA) |
| Body Font | Arial 11pt |
| Heading 1 | Arial 16pt Bold, navy (#1B3A5C) |
| Heading 2 | Arial 14pt Bold, dark gray (#333333) |
| Heading 3 | Arial 12pt Bold, dark gray (#333333) |
| Header | Company logo (left) + Document title (right) |
| Footer | Page X of Y (center) + Document version (right) |
| Table Headers | Background #1B3A5C, white text, bold |
| Table Borders | Light gray #CCCCCC, 1px |

### Cover Page (All Documents)

Every document starts with a cover page containing:

```
┌─────────────────────────────────────┐
│                                     │
│        [INDUSIA AI Logo]            │
│                                     │
│   INDUSIA AI VISUAL INSPECTION      │
│           SYSTEM                    │
│                                     │
│   ──────────────────────────        │
│                                     │
│   [Document Title]                  │
│                                     │
│   Version: 1.0                      │
│   Date: [Generated Date]           │
│   Document No: INDUSIA-DOC-XXX     │
│                                     │
│   ──────────────────────────        │
│                                     │
│   Prepared by: INDUSIA AI           │
│   Prepared for: [Customer Name]     │
│                                     │
│   CONFIDENTIAL                      │
│                                     │
└─────────────────────────────────────┘
```

### Revision History Table (Page 2)

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | [Date] | INDUSIA AI | Initial release |

### Image Embedding Rules

- All screenshots MUST be embedded (not linked)
- Max width: 6 inches (8640 EMU × 914400)
- Always add figure caption below: "Figure X: [Description]"
- Screenshots should have 1px gray border
- Hardware photos keep original aspect ratio

---

## Document 1: System Architecture Guide

**Filename:** `01_System_Architecture_Guide.docx`  
**Audience:** Customer IT team, Engineers  
**Purpose:** Technical overview of system design and integration

### Outline

```
1. Introduction
   1.1 System Overview
   1.2 Purpose and Scope
   1.3 Glossary/Acronyms (AOI, PCB, HMI, SSE, PLC, RBAC, SPC)

2. System Architecture
   2.1 High-Level Architecture Diagram
       - Factory floor vs Office network diagram
       - Component: AI Backend, Next.js UI, PostgreSQL, PostgREST, Supabase Cloud
   2.2 Hardware Components
       - Machine overview (image1.jpg from manual)
       - Camera system (TOP/BOTTOM)
       - PLC integration
       - Display and operator interface
   2.3 Software Components
       - AI Backend (Python FastAPI): camera, inference, PLC, image storage
       - HMI (Next.js 14): display, operator workflow, management
       - Database (PostgreSQL + PostgREST): local CRUD API
       - Cloud (Supabase): sync, backup, analytics, AI retraining

3. Network Architecture
   3.1 Dual Network Design
       - Factory floor network (offline, isolated)
       - Office network (internet access, bridge PC)
   3.2 Communication Protocols
       - SSE (AI Backend → UI): real-time inspection events
       - REST API (UI → AI Backend): operator confirmations
       - PostgREST (UI → DB): all data CRUD
       - Supabase Client (UI → Cloud): periodic sync
   3.3 Ports and Endpoints
       - AI Backend: port 8001
       - Next.js: port 3000
       - PostgREST: port 3001
       - PostgreSQL: port 5432

4. Data Flow
   4.1 Inspection Flow (SSE event → operator decision → DB → PLC)
   4.2 False Call Flow (operator disagree → reason capture → cloud upload → retraining)
   4.3 Cloud Sync Flow (local DB → bridge PC → Supabase)
   4.4 Work Order Flow (create → activate → inspect → complete)

5. Database Schema
   5.1 Schema Overview (categories: Master, Production, Inspection, Training, RBAC)
   5.2 Key Tables and Relationships
   5.3 Data Ownership Matrix (UI vs AI Backend read/write)

6. Security Architecture
   6.1 Authentication (HTTP-only cookies, bcrypt, 24h expiry)
   6.2 Authorization (RBAC: Admin, Engineer, Operator, Manager)
   6.3 Input Validation (Zod schemas, sanitization)
   6.4 Network Security (rate limiting, security headers, CSRF)
   6.5 Penetration Test Summary (47 fixes)

7. AI/ML Pipeline
   7.1 Model Architecture (object detection for PCB defects)
   7.2 Training Data Collection (false call → cloud → retraining loop)
   7.3 Model Deployment (per-line model assignment)
   7.4 Continuous Improvement Cycle

8. Integration Points
   8.1 PLC Communication (Serial RS232, conveyor control, reject mechanism)
   8.2 Camera Integration (TOP/BOTTOM capture, UV/Cam lamp control)
   8.3 Cloud Services (Supabase Storage, future Modal.com GPU training)
```

### Data Sources

- Architecture diagram: generate from project reference (02-indusia-project-reference-v2.md)
- Hardware images: extract from `manual book (english version).docx`
- API details: read `docs/API_AI_BACKEND.md`
- Database schema: read `docs/DATABASE_SCHEMA.md`
- Security: reference 03-aoi-domain-knowledge.md (penetration test section)
- Network diagram: generate from critical_context in project instructions

---

## Document 2: Operator Manual

**Filename:** `02_Operator_Manual.docx`  
**Audience:** Factory floor operators  
**Purpose:** Day-to-day operation instructions with screenshots

### Writing Style

- Simple, direct language (max Grade 8 reading level)
- Every action has: numbered step + screenshot
- Use ⚠️ WARNING, ℹ️ NOTE, ✅ TIP callout boxes
- Minimum 30mm button references match ISA-101

### Outline

```
1. Introduction
   1.1 About This Manual
   1.2 Safety Warnings
   1.3 System Overview (simplified diagram)

2. Getting Started
   2.1 Login
       [Screenshot: Login_Page.png]
       Steps: open browser → enter credentials → select role
   2.2 Navigation Overview
       - Sidebar menu per role
       - Keyboard shortcuts (G=GOOD, N=NG, ?=Help)
   2.3 Logout

3. Machine Operation
   3.1 Power-On Procedure
       (from existing manual: steps 1-6 with hardware images)
   3.2 Loading PCB
       (from existing manual: steps 7-9 with DO/DON'T images)
   3.3 Starting Inspection
       (from existing manual: steps 10-11)
   3.4 Power-Off Procedure

4. Live Inspection (CRITICAL SECTION)
   4.1 Select Production Line
       [Screenshot: 7_Live_Inspection/1_Live_view_Select_Line.png]
   4.2 Select AI Model
       [Screenshot: 7_Live_Inspection/2_Live_view_Select_Model.png]
   4.3 Start Inspection
       [Screenshot: 7_Live_Inspection/3_Live_view_start_inspection.png]
   4.4 Understanding AI Results
       - Board image with defect bounding boxes
       - AI confidence percentage
       - AI decision: PASS or FAIL
   4.5 Making Decisions: GOOD or NG
       [Screenshot: 7_Live_Inspection/4_Live_Inspection_Verification.png]
       - GOOD button (green, keyboard: G) → board passes
       - NG button (red, keyboard: N) → board rejected
   4.6 False Call Handling
       [Screenshot: 7_Live_Inspection/5_Live_Inspection_Verification_by_Operator.png]
       - When AI says FAIL but operator sees GOOD → False Call auto-detected
       - When AI says PASS but operator sees NG → False Call auto-detected
       - Select reason from dropdown
       - This data improves AI accuracy over time
   4.7 Auto-NG Mode
       [Screenshot: 7_Live_Inspection/5_Live_Inspection_Auto-NG_Verification.png]

5. Work Order Management
   5.1 Viewing Work Orders
       [Screenshot: 2_Work_Orders/1_Work_Orders_Menu.png]
   5.2 Creating Work Orders
       [Screenshot: 2_Work_Orders/2_create_work_order_form.png]
   5.3 Work Order Status Flow
       [Screenshot: 2_Work_Orders/3_wo_active_status_on_hold_completed.png]
       Draft → Ready → Active → Completed (or On Hold)

6. Override Queue (Manager)
   6.1 Reviewing Overrides
       [Screenshot: 8_Overdue_Queue_Menu/1_Overdue_Queue_Menu.png]
   6.2 Approve/Reject Decisions
       [Screenshot: 8_Overdue_Queue_Menu/1_Overdue_Queue_Approve_Reject.png]

7. Cloud Sync (Manager)
   7.1 Sync Dashboard
       [Screenshot: 9_Sync_to_Cloud_Menu/1_Sync_to_Cloud_Menu.png]
   7.2 Manual Sync
       [Screenshot: 9_Sync_to_Cloud_Menu/2_Sync_to_Cloud_in_progress_modal.png]
   7.3 Sync History
       [Screenshot: 9_Sync_to_Cloud_Menu/3_Sync_to_Cloud_History.png]
   7.4 Sync Detail
       [Screenshot: 9_Sync_to_Cloud_Menu/4_Sync_History_Detail.png]

8. Administration (Engineer/Admin Only)
   8.1 Master Data Management
       [Screenshot: 1_Master_data/1_master_data_menu.png]
       - Customers [Screenshot: 1_Master_data/2_master_data_customer_menu.png]
       - Sections [Screenshot: 1_Master_data/3_master_data_section_menu.png]
       - Production Lines [Screenshot: 1_Master_data/4_master_data_production_line_menu.png]
       - Board Models [Screenshot: 1_Master_data/5_master_data_board_model_menu.png]
       - False Call Reasons [Screenshot: 1_Master_data/6_master_data_false_call_reason_menu.png]
   8.2 User Management
       [Screenshot: 3_User_managements/1_user_management_menu.png]
       - Add User [Screenshot: 3_User_managements/4_user_management_Add_Form.png]
       - Edit User [Screenshot: 3_User_managements/3_user_management_Edit_Form.png]
       - User Actions [Screenshot: 3_User_managements/2_user_management_action.png]
   8.3 Role Management
       [Screenshot: 4_Role_Managements/1_role_management_menu.png]
       - Add Role [Screenshot: 4_Role_Managements/3_role_management_Add_New_Role_Form.png]
       - Edit Role [Screenshot: 4_Role_Managements/2_role_management_Edit_Role_Form.png]
   8.4 Permission Matrix
       [Screenshot: 5_Permission_Matrix/1_Permission_Matrix_Menu.png]
       - Grant/Revoke [Screenshot: 5_Permission_Matrix/2_Permission_Matrix_grant_revoke_action.png]
   8.5 System Update
       [Screenshot: 6_System_Update/1_System_Update_Menu.png]

Appendix A: Keyboard Shortcuts
Appendix B: Role-Permission Matrix
Appendix C: Glossary
```

---

## Document 3: Maintenance Manual

**Filename:** `03_Maintenance_Manual.docx`  
**Audience:** Maintenance technicians  
**Purpose:** Preventive maintenance procedures and schedules

### Outline

```
1. Introduction
   1.1 Maintenance Philosophy
   1.2 Safety Precautions
   1.3 Required Tools and Materials

2. Preventive Maintenance Schedule
   [Table: Component × Frequency × Procedure]

   DAILY:
   - RCCB and MCB 1-3: Verify ON position, test RCCB trip
   - Air Pressure: Check 6 bar, inspect for leaks
   - Visual inspection of cables and connectors

   WEEKLY:
   - Camera Lens: Wipe with dry microfiber cloth
   - Camera Calibration: Rotate focus ring slowly, verify with resolution target
   - Cam Lamp: Verify dimmer/potentiometer at 1318 lux
   - UV Lamp: Check intensity (for applicable part numbers only)
   - Clean PCB pallet and base jig

   MONTHLY:
   - Database backup verification
   - System log review
   - Measurement System Analysis (Gauge R&R < 25% P/T)
   - Check all pneumatic connections and cylinders

   6-MONTHLY:
   - PLC Battery: Test voltage, replace if < 2.5V
   - Full camera system recalibration
   - Golden board verification

3. Camera System Maintenance
   3.1 Lens Cleaning Procedure
   3.2 Focus Calibration (using resolution target)
   3.3 Lighting Calibration (lux meter verification)
   3.4 Golden Board Verification Procedure

4. Pneumatic System
   4.1 Air Pressure Adjustment (6 bar)
   4.2 Filter Regulator Maintenance
   4.3 Cylinder Inspection

5. Electrical System
   5.1 RCCB/MCB Testing
   5.2 Power Supply Verification
   5.3 PLC Battery Replacement
   5.4 Cable Inspection

6. Software Maintenance
   6.1 Database Backup Procedure
   6.2 System Update (via HMI System Update menu)
   6.3 Log File Management
   6.4 Cloud Sync Verification

7. Spare Parts List
   [Table: Part Number × Description × Qty × Reorder Level]

8. Maintenance Log Template
   [Table: Date × Component × Action × Technician × Result]

Appendix A: Torque Specifications
Appendix B: Lubrication Chart
Appendix C: Calibration Record Forms
```

### Data Sources

- Maintenance table from existing manual book
- Hardware images (machine overview, camera chamber)
- Camera calibration from AOI domain knowledge (03-aoi-domain-knowledge.md)

---

## Document 4: Troubleshooting Guide

**Filename:** `04_Troubleshooting_Guide.docx`  
**Audience:** Technicians and Engineers  
**Purpose:** Systematic problem resolution

### Outline

```
1. Introduction
   1.1 How to Use This Guide
   1.2 Severity Levels (Critical/Major/Minor)
   1.3 Escalation Procedure

2. Quick Reference — Symptom Table
   [Large table: Symptom → Possible Cause → Solution → Severity]

3. Hardware Issues
   3.1 Machine Won't Power On
       - Check AC ONLINE lamp
       - Verify RCCB/MCB positions
       - Check main switch and power cable
   3.2 Camera Issues
       - Camera OFFLINE (check connection, restart AI Backend)
       - Blurry images (focus calibration)
       - Dark/bright images (lighting adjustment)
   3.3 PLC Issues
       - PLC OFFLINE (check serial RS232 connection)
       - Conveyor not moving (check PLC program, air pressure)
       - Reject mechanism not working (check cylinder, air pressure)
   3.4 Pneumatic Issues
       - Low pressure (check compressor, filter regulator)
       - Cylinder not actuating (check solenoid valve, air lines)

4. Software Issues
   4.1 HMI Not Loading
       - Check Next.js server (port 3000)
       - Check PostgREST (port 3001)
       - Browser cache clear
   4.2 Login Failed
       - Verify credentials
       - Check user status (active/inactive)
       - Check database connectivity
   4.3 SSE Connection Lost
       - AI Backend status check (port 8001)
       - Network connectivity between HMI and AI Backend
       - Reconnection is automatic (max 10 retries)
   4.4 Database Issues
       - PostgreSQL not responding (check service)
       - PostgREST errors (check configuration)
       - Data not saving (check permissions)

5. AI/Inspection Issues
   5.1 High False Call Rate (>25%)
       - Check camera focus and lighting
       - Verify correct AI model assigned to line
       - Review golden board calibration
       - May need model retraining
   5.2 AI Confidence Consistently Low (<60%)
       - Camera/lighting degradation
       - PCB variant not in training data
       - Model needs retraining
   5.3 Inspection Too Slow
       - Check AI Backend CPU/GPU load
       - Network latency between components
       - Image resolution settings

6. Network/Sync Issues
   6.1 Cloud Sync Failed
       - Check bridge PC connectivity (dual NIC)
       - Verify Supabase credentials
       - Check sync lock status
   6.2 SSE Events Not Arriving
       - AI Backend health check
       - Firewall rules between ports
       - Check browser dev tools for SSE errors

7. Error Code Reference
   [Table: Error Code → Description → Resolution]

Appendix A: System Health Check Procedure
Appendix B: Log File Locations
Appendix C: Contact Information
```

---

## Document 5: FAT Report (Factory Acceptance Test)

**Filename:** `05_FAT_Report.docx`  
**Audience:** QC team + Customer witness  
**Purpose:** Verify all functions work correctly at factory/workshop before shipping

### Outline

```
COVER PAGE:
  FAT Report — INDUSIA AI Visual Inspection System
  Test Date: [Date]
  Location: [Factory Address]
  Customer: [Customer Name]
  Machine Serial: [Serial Number]

1. Introduction
   1.1 Purpose
   1.2 Scope
   1.3 Reference Documents
   1.4 Test Environment Description

2. Test Configuration
   2.1 Hardware Configuration
       [Table: Component × Model × Serial × Status]
       - CPU, Display, Camera (TOP/BOTTOM), PLC, Lamps, Pneumatics
   2.2 Software Configuration
       [Table: Software × Version]
       - Next.js HMI, AI Backend, PostgreSQL, PostgREST, AI Model
   2.3 Network Configuration
       - IP addresses, ports, connectivity verification

3. Functional Test Results
   [Each test: ID, Description, Procedure, Expected Result, Actual Result, PASS/FAIL]

   3.1 Power-On Sequence Tests
       FAT-001: AC Power verification
       FAT-002: RCCB/MCB activation
       FAT-003: All lamps functional
       FAT-004: Air pressure verification (6 bar)

   3.2 Hardware Tests
       FAT-010: Camera TOP capture
       FAT-011: Camera BOTTOM capture
       FAT-012: PLC communication
       FAT-013: Conveyor operation
       FAT-014: Reject mechanism
       FAT-015: Emergency stop

   3.3 Software Tests — Authentication
       FAT-020: Login with valid credentials
       FAT-021: Login with invalid credentials (expect failure)
       FAT-022: Role-based menu access (4 roles)
       FAT-023: Logout

   3.4 Software Tests — Master Data
       FAT-030: Customer CRUD
       FAT-031: Section CRUD
       FAT-032: Production Line CRUD
       FAT-033: Board Model CRUD
       FAT-034: False Call Reason CRUD

   3.5 Software Tests — Work Order
       FAT-040: Create Work Order
       FAT-041: Activate Work Order
       FAT-042: Complete Work Order
       FAT-043: Work Order counter accuracy

   3.6 Software Tests — Live Inspection
       FAT-050: SSE connection established
       FAT-051: AI inference produces result
       FAT-052: Bounding box overlay displayed
       FAT-053: GOOD button confirms pass
       FAT-054: NG button confirms reject
       FAT-055: False call detection (AI FAIL + Operator GOOD)
       FAT-056: False call detection (AI PASS + Operator NG)
       FAT-057: False call reason submission
       FAT-058: PLC receives GOOD/NG signal
       FAT-059: Board counter increments correctly

   3.7 Software Tests — Management
       FAT-060: Override queue displays pending items
       FAT-061: Override approve/reject
       FAT-062: User management CRUD
       FAT-063: Role management CRUD
       FAT-064: Permission matrix update

   3.8 Software Tests — Cloud Sync
       FAT-070: Manual sync trigger
       FAT-071: Sync completes without error
       FAT-072: Sync history recorded
       FAT-073: False call images uploaded to Supabase Storage

   3.9 Safety Tests
       FAT-080: Emergency stop halts operation immediately
       FAT-081: Power loss recovery
       FAT-082: Network disconnect graceful handling

4. Test Summary
   [Table: Category × Total Tests × Passed × Failed × N/A]

5. Non-Conformance Report (NCR)
   [Table: NCR # × Test ID × Description × Severity × Resolution × Status]

6. Conclusion and Recommendation
   □ System ACCEPTED for shipment
   □ System ACCEPTED with conditions (list NCRs to resolve)
   □ System REJECTED (list critical failures)

7. Sign-Off
   [Table format:]
   | Role | Name | Signature | Date |
   | INDUSIA AI — Test Engineer | | | |
   | INDUSIA AI — QA Manager | | | |
   | Customer — Witness | | | |
   | Customer — Project Manager | | | |
```

---

## Document 6: SAT Report (Site Acceptance Test)

**Filename:** `06_SAT_Report.docx`  
**Audience:** Customer + Installation team  
**Purpose:** Verify system works correctly at customer production site

### Outline

```
COVER PAGE:
  SAT Report — INDUSIA AI Visual Inspection System
  Test Date: [Date]
  Location: [Customer Factory Address]
  Customer: [Customer Name]
  Machine Serial: [Serial Number]
  FAT Reference: INDUSIA-FAT-[Number]

1. Introduction
   1.1 Purpose
   1.2 Scope (differences from FAT)
   1.3 Reference Documents (including FAT report)
   1.4 Site Environment Description

2. Installation Verification
   2.1 Physical Installation
       [Table: Check Item × Status × Notes]
       - Machine placement and leveling
       - Power connection (220VAC)
       - Air compressor connection (6 bar)
       - Network cabling
       - Display and operator station ergonomics
   2.2 Network Setup
       - Factory floor network connectivity
       - Office/bridge PC configuration (if applicable)
       - Supabase cloud connectivity (if applicable)
   2.3 Software Configuration
       - All environment variables configured
       - Database initialized with customer master data
       - AI model assigned to production lines
       - User accounts created per customer requirements

3. Site-Specific Functional Tests
   [Same test ID format as FAT but with SAT prefix]

   3.1 Environmental Tests
       SAT-001: System operates under factory floor temperature
       SAT-002: System operates under factory lighting conditions
       SAT-003: System operates with factory vibration levels
       SAT-004: System operates with actual air supply

   3.2 Integration Tests
       SAT-010: Inspection with actual production PCBs
       SAT-011: AI accuracy on customer's specific board types
       SAT-012: Conveyor speed matches production requirements
       SAT-013: Cycle time meets specification (boards/hour)

   3.3 Production Trial
       SAT-020: Run [X] boards continuously without error
       SAT-021: AI detection rate ≥ 97% (DDR)
       SAT-022: False call rate < 10% (FCR)
       SAT-023: First pass yield > 95% (FPY)
       SAT-024: Operator workflow timing acceptable

   3.4 Data Integrity Tests
       SAT-030: Inspection results saved to database
       SAT-031: Work order counters accurate after trial run
       SAT-032: Cloud sync with production data (if applicable)

   3.5 Operator Validation
       SAT-040: Operator trained and can perform full workflow
       SAT-041: Operator can handle false call submission
       SAT-042: Operator can create/manage work orders

4. Performance Metrics
   [Table: Metric × Target × Actual × PASS/FAIL]
   - Detection Rate (DDR): ≥ 97%
   - False Call Rate (FCR): < 10%
   - First Pass Yield (FPY): > 95%
   - Escape Rate: < 1%
   - Throughput: [X] boards/hour
   - System Uptime: > 99% during trial

5. Test Summary
   [Table: Category × Total Tests × Passed × Failed × N/A]

6. Punch List / Outstanding Items
   [Table: Item # × Description × Priority × Responsible × Due Date × Status]

7. Training Confirmation
   [Table: Trainee Name × Role × Training Date × Topics Covered × Trainer]

8. Warranty and Support
   - Warranty start date
   - Warranty period
   - Support contact information
   - Escalation procedure

9. Conclusion and Recommendation
   □ System ACCEPTED for production use
   □ System ACCEPTED with punch list items (to be resolved by [date])
   □ System REJECTED (list critical failures)

10. Sign-Off
    | Role | Name | Signature | Date |
    | INDUSIA AI — Installation Engineer | | | |
    | INDUSIA AI — Project Manager | | | |
    | Customer — Production Manager | | | |
    | Customer — Quality Manager | | | |
    | Customer — IT Manager | | | |
```

---

## docx-js Generation Pattern

### Common Setup for All Documents

```javascript
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, WidthType, ShadingType,
  PageBreak, PageNumber, NumberFormat
} = require('docx')

// ── Constants ──
const COLORS = {
  navy: '1B3A5C',
  darkGray: '333333',
  lightGray: 'CCCCCC',
  tableHeader: '1B3A5C',
  tableAlt: 'F5F7FA',
  white: 'FFFFFF',
  pass: '10B981',
  fail: 'EF4444',
  warning: 'F59E0B',
}

const FONTS = { body: 'Arial', size: 22 }  // 11pt = 22 half-points

// ── Shared styles ──
const docStyles = {
  default: {
    document: { run: { font: FONTS.body, size: FONTS.size } }
  },
  paragraphStyles: [
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
      quickFormat: true,
      run: { size: 32, bold: true, font: 'Arial', color: COLORS.navy },
      paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
      quickFormat: true,
      run: { size: 28, bold: true, font: 'Arial', color: COLORS.darkGray },
      paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 }
    },
    {
      id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
      quickFormat: true,
      run: { size: 24, bold: true, font: 'Arial', color: COLORS.darkGray },
      paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 }
    },
  ]
}

// ── Helper: embed image ──
function embedImage(imagePath, widthInches = 6, heightInches = 4) {
  const buffer = fs.readFileSync(imagePath)
  const ext = path.extname(imagePath).slice(1)
  return new ImageRun({
    data: buffer,
    transformation: {
      width: widthInches * 96,   // approx pixels at 96 DPI
      height: heightInches * 96,
    },
    type: ext === 'jpg' ? 'jpg' : ext,
  })
}

// ── Helper: figure caption ──
function figureCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200 },
    children: [
      new TextRun({ text, italics: true, size: 20, color: '666666' })
    ]
  })
}

// ── Helper: styled table with header row ──
function styledTable(headers, rows, columnWidths) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightGray }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 }
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0)

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => new TableCell({
          borders,
          width: { size: columnWidths[i], type: WidthType.DXA },
          shading: { fill: COLORS.tableHeader, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: [new TextRun({ text: h, bold: true, color: COLORS.white, font: 'Arial', size: 20 })]
          })]
        }))
      }),
      // Data rows
      ...rows.map((row, rowIdx) => new TableRow({
        children: row.map((cell, i) => new TableCell({
          borders,
          width: { size: columnWidths[i], type: WidthType.DXA },
          shading: rowIdx % 2 === 0
            ? { fill: COLORS.white, type: ShadingType.CLEAR }
            : { fill: COLORS.tableAlt, type: ShadingType.CLEAR },
          margins: cellMargins,
          children: [new Paragraph({
            children: [new TextRun({ text: String(cell), font: 'Arial', size: 20 })]
          })]
        }))
      }))
    ]
  })
}

// ── Helper: PASS/FAIL cell for test reports ──
function testResultCell(result, width) {
  const color = result === 'PASS' ? COLORS.pass : result === 'FAIL' ? COLORS.fail : COLORS.warning
  // ... return TableCell with colored background
}

// ── Helper: cover page ──
function coverPage(title, docNumber, customerName, date) {
  return {
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      },
      pageNumbers: { start: 0 }
    },
    children: [
      new Paragraph({ spacing: { before: 3000 } }),
      // Logo placeholder
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: 'INDUSIA AI', size: 48, bold: true, color: COLORS.navy, font: 'Arial' })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [new TextRun({ text: 'VISUAL INSPECTION SYSTEM', size: 28, color: COLORS.darkGray })]
      }),
      // Separator
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navy } },
        children: []
      }),
      // Title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: title, size: 36, bold: true, color: COLORS.navy })]
      }),
      // Metadata
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [new TextRun({ text: `Version 1.0  |  ${date}  |  ${docNumber}`, size: 22, color: '666666' })]
      }),
      // Customer
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800 },
        children: [
          new TextRun({ text: 'Prepared for: ', size: 22, color: '666666' }),
          new TextRun({ text: customerName, size: 22, bold: true }),
        ]
      }),
      // Confidential
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: 'CONFIDENTIAL', size: 20, bold: true, color: COLORS.fail })]
      }),
      new Paragraph({ children: [new PageBreak()] })
    ]
  }
}
```

### Per-Document Generation

Each document script follows this pattern:

```javascript
// generate_[docname].js

const { Document, Packer } = require('docx')
const fs = require('fs')
// import shared helpers from above

const SCREENSHOT_BASE = 'docs/FAT_SAT/Operation_Manual'

async function generate() {
  const doc = new Document({
    styles: docStyles,
    sections: [
      coverPage('Document Title', 'INDUSIA-DOC-001', 'Customer Name', '2026-02-16'),
      {
        properties: { /* A4, margins, header/footer */ },
        children: [
          // Revision history table
          // Table of Contents
          // Content sections with headings, text, images, tables
        ]
      }
    ]
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync('docs/FAT_SAT/deliverables/filename.docx', buffer)
  console.log('Generated: filename.docx')
}

generate()
```

---

## Quality Checklist

Before delivering each document, verify:

- [ ] Cover page has correct customer name, date, document number
- [ ] Revision history table present on page 2
- [ ] Table of contents present (or heading structure for TOC generation in Word)
- [ ] All screenshots embedded and visible (not broken links)
- [ ] Figure captions numbered sequentially
- [ ] Headers/footers on every page (except cover)
- [ ] Page numbers correct
- [ ] No placeholder text remaining ([Customer Name], [Date], etc.)
- [ ] Consistent formatting throughout
- [ ] All tables have header rows with navy background
- [ ] FAT/SAT: All test IDs sequential and unique
- [ ] FAT/SAT: Sign-off table at end
- [ ] Spell check (no "APPROVE"/"REJECT" — use "GOOD"/"NG" for operator actions)
- [ ] File saved to `docs/FAT_SAT/deliverables/`

---

## Usage with Claude Code

### Generate Single Document

```
/generate-doc [document-number]
```

Example: `/generate-doc 2` → generates Operator Manual

### Generate All Documents

```
/generate-all-docs --customer "PT ABC Manufacturing" --date "2026-02-16"
```

### Update Existing Document

```
/update-doc [document-number] --section [section-number]
```

---

## Important Notes

1. **Screenshots are pre-captured** — do not regenerate. Use as-is from `docs/FAT_SAT/Operation_Manual/`
2. **Hardware images** are inside the existing `.docx` files — extract using `unpack.py` if needed
3. **Customer-specific fields** (name, address, serial numbers) should be parameterized with `[brackets]` in templates, filled during generation
4. **FAT/SAT test results** are blank by default (to be filled during actual testing) — only generate the template/checklist structure
5. **GOOD/NG terminology** — never use old terms (APPROVE, FALSE CALL, REJECT) in operator-facing documents
6. **Bilingual option** — documents are English by default. Indonesian translation can be generated separately if requested
