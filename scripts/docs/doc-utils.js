/**
 * INDUSIA Document Generator — Shared Utilities
 * 
 * Provides reusable docx-js building blocks for all 6 delivery documents.
 * Usage: const utils = require('./doc-utils')
 */

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, HeadingLevel,
  LevelFormat, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageBreak, PageNumber, NumberFormat, TabStopType, TabStopPosition,
  PositionalTab, PositionalTabAlignment, PositionalTabRelativeTo, PositionalTabLeader,
  TableOfContents, StyleLevel,
} = require('docx')

// ─── Company Branding ───
const COMPANY = {
  name: 'PT. Riyo Utama Indonesia',
  short: 'RUI',
  address: 'Jl. Letjen R. Suprapto, Buana Central Park, Monroe 3, Batam',
  salesManager: 'Rico Sihombing',
  projectManager: 'Ali Sadikin',
  product: 'INDUSIA AI',
  productSub: 'VISUAL INSPECTION SYSTEM',
}

// ─── Project Paths ───
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, 'docs', 'FAT_SAT', 'Operation_Manual_HMI')
const HARDWARE_DIR = path.join(PROJECT_ROOT, 'docs', 'FAT_SAT')
const HARDWARE_IMAGES_DIR = path.join(PROJECT_ROOT, 'docs', 'FAT_SAT', 'extracted_images', 'manual_book')
const MECH_IMAGES_DIR = path.join(PROJECT_ROOT, 'docs', 'FAT_SAT', 'extracted_images', 'mechanical')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs', 'FAT_SAT', 'deliverables')
const DOCS_DIR = path.join(PROJECT_ROOT, 'docs')

// ─── Colors ───
const COLORS = {
  navy: '1B3A5C',
  darkGray: '333333',
  medGray: '666666',
  lightGray: 'CCCCCC',
  bgGray: 'F5F7FA',
  white: 'FFFFFF',
  pass: '10B981',
  fail: 'EF4444',
  warning: 'F59E0B',
  blue: '475CA7',
}

// ─── Page Setup (A4) ───
const PAGE_A4 = {
  size: { width: 11906, height: 16838 },
  margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
}
const CONTENT_WIDTH = 9026 // A4 minus 1-inch margins

// ─── Font Defaults ───
const FONT = 'Arial'
const BODY_SIZE = 22 // 11pt in half-points

// ─── Standard Styles ───
const DOC_STYLES = {
  default: {
    document: {
      run: { font: FONT, size: BODY_SIZE, color: COLORS.darkGray },
      paragraph: { spacing: { after: 120, line: 276 } },
    },
  },
  paragraphStyles: [
    {
      id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 32, bold: true, font: FONT, color: COLORS.navy },
      paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
    },
    {
      id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 28, bold: true, font: FONT, color: COLORS.darkGray },
      paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 },
    },
    {
      id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
      run: { size: 24, bold: true, font: FONT, color: COLORS.darkGray },
      paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
    },
  ],
}

// ─── Numbering (bullets + ordered lists) ───
const NUMBERING_CONFIG = {
  config: [
    {
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '\u2022',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: 'numbers',
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
    {
      reference: 'numbersSecond',
      levels: [{
        level: 0, format: LevelFormat.DECIMAL, text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    },
  ],
}

// ─── Table Helpers ───
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightGray }
const BORDERS_ALL = { top: BORDER_THIN, bottom: BORDER_THIN, left: BORDER_THIN, right: BORDER_THIN }
const CELL_MARGINS = { top: 60, bottom: 60, left: 100, right: 100 }

/**
 * Create a styled table with header row
 * @param {string[]} headers - Column header texts
 * @param {string[][]} rows - 2D array of cell texts
 * @param {number[]} columnWidths - Width in DXA per column (must sum to CONTENT_WIDTH or less)
 * @returns {Table}
 */
function styledTable(headers, rows, columnWidths) {
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0)

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          new TableCell({
            borders: BORDERS_ALL,
            width: { size: columnWidths[i], type: WidthType.DXA },
            shading: { fill: COLORS.navy, type: ShadingType.CLEAR },
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
              children: [new TextRun({ text: h, bold: true, color: COLORS.white, font: FONT, size: 20 })],
            })],
          })
        ),
      }),
      // Data rows with alternating bg
      ...rows.map((row, rIdx) =>
        new TableRow({
          children: row.map((cell, cIdx) =>
            new TableCell({
              borders: BORDERS_ALL,
              width: { size: columnWidths[cIdx], type: WidthType.DXA },
              shading: {
                fill: rIdx % 2 === 0 ? COLORS.white : COLORS.bgGray,
                type: ShadingType.CLEAR,
              },
              margins: CELL_MARGINS,
              children: [new Paragraph({
                children: [new TextRun({ text: String(cell || ''), font: FONT, size: 20 })],
              })],
            })
          ),
        })
      ),
    ],
  })
}

/**
 * Create a test result table for FAT/SAT
 * Columns: Test ID | Description | Procedure | Expected | Actual | Result
 */
function testTable(tests) {
  const widths = [900, 1800, 1800, 1800, 1400, 1026]
  const headers = ['Test ID', 'Description', 'Procedure', 'Expected Result', 'Actual Result', 'Result']
  const rows = tests.map(t => [t.id, t.description, t.procedure || '', t.expected || '', '', ''])
  return styledTable(headers, rows, widths)
}

/**
 * Create a sign-off table
 * @param {Array<{role: string, org: string}>} signatories
 */
function signOffTable(signatories) {
  const widths = [2500, 2200, 2200, 2126]
  const headers = ['Role', 'Name', 'Signature', 'Date']
  const rows = signatories.map(s => [`${s.org} \u2014 ${s.role}`, '', '', ''])
  return styledTable(headers, rows, widths)
}

// ─── Image Helpers ───

/**
 * Read image dimensions from PNG/JPEG file header (no external dependency)
 * @param {Buffer} buffer - File buffer
 * @param {string} ext - File extension (png, jpg, jpeg)
 * @returns {{ width: number, height: number } | null}
 */
function readImageDimensions(buffer, ext) {
  try {
    if (ext === 'png') {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (ext === 'jpg' || ext === 'jpeg') {
      let i = 2
      while (i < buffer.length - 9) {
        if (buffer[i] === 0xFF) {
          const marker = buffer[i + 1]
          if (marker === 0xC0 || marker === 0xC2) {
            return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
          }
          if (marker === 0xD9 || marker === 0xDA) break
          const len = buffer.readUInt16BE(i + 2)
          i += 2 + len
        } else {
          i++
        }
      }
    }
  } catch (_) { /* fall through to null */ }
  return null
}

/**
 * Embed a screenshot with figure caption — auto-scales proportionally
 * @param {string} imagePath - Absolute or relative path to image
 * @param {string} caption - Figure caption text
 * @param {number} figNum - Figure number
 * @param {object} [opts] - { widthPx, heightPx, maxWidth }
 * @returns {Paragraph[]} - Array of paragraphs (image + caption)
 */
function embedScreenshot(imagePath, caption, figNum, opts = {}) {
  const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.join(PROJECT_ROOT, imagePath)

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[WARN] Image not found: ${resolvedPath}`)
    return [
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({
          text: `[Image not found: ${path.basename(imagePath)}]`,
          italics: true, color: COLORS.fail, size: 20,
        })],
      }),
      figureCaption(caption, figNum),
    ]
  }

  const buffer = fs.readFileSync(resolvedPath)
  const ext = path.extname(resolvedPath).slice(1).toLowerCase()
  const imageType = ext === 'jpg' || ext === 'jpeg' ? 'jpg' : 'png'

  // Auto-detect dimensions and scale proportionally
  const maxWidth = opts.maxWidth || 620  // ~6.5 inches at 96dpi — near full A4 content width
  let widthPx, heightPx

  if (opts.widthPx && opts.heightPx) {
    widthPx = opts.widthPx
    heightPx = opts.heightPx
  } else {
    const dims = readImageDimensions(buffer, ext)
    if (dims && dims.width > 0 && dims.height > 0) {
      const ratio = dims.height / dims.width
      widthPx = opts.widthPx || Math.min(dims.width, maxWidth)
      heightPx = Math.round(widthPx * ratio)
    } else {
      // Fallback if dimensions can't be read
      widthPx = opts.widthPx || maxWidth
      heightPx = opts.heightPx || Math.round(widthPx * 0.56)
    }
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 40 },
      children: [
        new ImageRun({
          data: buffer,
          transformation: { width: widthPx, height: heightPx },
          type: imageType,
        }),
      ],
    }),
    figureCaption(caption, figNum),
  ]
}

/**
 * Figure caption paragraph
 */
function figureCaption(caption, figNum) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 40, after: 200 },
    children: [
      new TextRun({ text: `Figure ${figNum}: `, italics: true, bold: true, size: 20, color: COLORS.medGray }),
      new TextRun({ text: caption, italics: true, size: 20, color: COLORS.medGray }),
    ],
  })
}

// ─── Structural Helpers ───

/**
 * Cover page section
 */
function coverPage(title, docNumber, customerName, date) {
  return {
    properties: {
      page: PAGE_A4,
      pageNumbers: { start: 0 },
    },
    children: [
      // Company branding
      new Paragraph({ spacing: { before: 1200 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: COMPANY.name, size: 28, bold: true, color: COLORS.navy, font: FONT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60 },
        children: [new TextRun({ text: COMPANY.address, size: 18, color: COLORS.medGray, font: FONT })],
      }),
      // Separator
      new Paragraph({
        spacing: { before: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.lightGray, space: 1 } },
        children: [],
      }),
      // Product name
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [new TextRun({ text: COMPANY.product, size: 52, bold: true, color: COLORS.navy, font: FONT })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
        children: [new TextRun({ text: COMPANY.productSub, size: 26, color: COLORS.medGray, font: FONT })],
      }),
      // Thick separator
      new Paragraph({
        spacing: { before: 500 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.navy, space: 1 } },
        children: [],
      }),
      // Document title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 500 },
        children: [new TextRun({ text: title, size: 36, bold: true, color: COLORS.navy, font: FONT })],
      }),
      // Metadata
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300 },
        children: [new TextRun({ text: `Version 1.0  |  ${date}  |  ${docNumber}`, size: 22, color: COLORS.medGray })],
      }),
      // Separator
      new Paragraph({
        spacing: { before: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.lightGray, space: 1 } },
        children: [],
      }),
      // Prepared for (customer)
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
        children: [
          new TextRun({ text: 'Prepared for: ', size: 22, color: COLORS.medGray }),
          new TextRun({ text: customerName, size: 22, bold: true, color: COLORS.darkGray }),
        ],
      }),
      // Project team
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: 'Sales Manager: ', size: 20, color: COLORS.medGray }),
          new TextRun({ text: COMPANY.salesManager, size: 20, bold: true, color: COLORS.darkGray }),
          new TextRun({ text: '    |    ', size: 20, color: COLORS.lightGray }),
          new TextRun({ text: 'Project Manager: ', size: 20, color: COLORS.medGray }),
          new TextRun({ text: COMPANY.projectManager, size: 20, bold: true, color: COLORS.darkGray }),
        ],
      }),
      // Confidential
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 500 },
        children: [new TextRun({ text: 'CONFIDENTIAL', size: 20, bold: true, color: COLORS.fail, font: FONT })],
      }),
      // Page break
      new Paragraph({ children: [new PageBreak()] }),
    ],
  }
}

/**
 * Revision history section (always page 2)
 */
function revisionHistory(version, date, author, description) {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Revision History')],
    }),
    styledTable(
      ['Version', 'Date', 'Author', 'Description'],
      [[version, date, author || COMPANY.name, description]],
      [1200, 2000, 2400, 3426]
    ),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

/**
 * Table of Contents — Word auto-populates on open
 * Must be used with buildAndSave (which sets updateFields: true)
 */
function tableOfContents() {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('Table of Contents')],
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
      stylesWithLevels: [
        new StyleLevel('Heading1', 1),
        new StyleLevel('Heading2', 2),
        new StyleLevel('Heading3', 3),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ]
}

/**
 * Standard heading paragraph
 */
function heading(level, text) {
  const headingLevel = level === 1 ? HeadingLevel.HEADING_1
    : level === 2 ? HeadingLevel.HEADING_2
      : HeadingLevel.HEADING_3
  return new Paragraph({ heading: headingLevel, children: [new TextRun(text)] })
}

/**
 * Body text paragraph
 */
function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.spacingAfter || 120 },
    children: [new TextRun({
      text,
      font: FONT,
      size: BODY_SIZE,
      bold: opts.bold || false,
      italics: opts.italics || false,
      color: opts.color || COLORS.darkGray,
    })],
  })
}

/**
 * Bullet point
 */
function bullet(text, reference = 'bullets') {
  return new Paragraph({
    numbering: { reference, level: 0 },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  })
}

/**
 * Warning/Note/Tip callout box (rendered as shaded paragraph)
 */
function callout(type, text) {
  const config = {
    WARNING: { icon: '\u26A0\uFE0F', fill: 'FEF3CD', border: COLORS.warning },
    NOTE: { icon: '\u2139\uFE0F', fill: 'D1ECF1', border: COLORS.blue },
    TIP: { icon: '\u2705', fill: 'D4EDDA', border: COLORS.pass },
  }
  const c = config[type] || config.NOTE
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: c.border, space: 8 } },
    shading: { fill: c.fill, type: ShadingType.CLEAR },
    indent: { left: 200 },
    children: [
      new TextRun({ text: `${c.icon} ${type}: `, bold: true, font: FONT, size: BODY_SIZE }),
      new TextRun({ text, font: FONT, size: BODY_SIZE }),
    ],
  })
}

/**
 * Numbered step (for operator procedures)
 */
function numberedStep(text, reference = 'numbers') {
  return new Paragraph({
    numbering: { reference, level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  })
}

// ─── Header/Footer Factory ───

/**
 * Content section with header and footer
 */
function contentSection(docTitle, children) {
  return {
    properties: {
      page: PAGE_A4,
      pageNumbers: { start: 1 },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.navy, space: 4 } },
            children: [
              new TextRun({ text: COMPANY.name, bold: true, size: 16, color: COLORS.navy, font: FONT }),
              new TextRun({ text: `  |  ${COMPANY.product}`, size: 16, color: COLORS.medGray, font: FONT }),
              new TextRun({ text: `  |  ${docTitle}`, size: 16, color: COLORS.medGray, font: FONT }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.lightGray, space: 4 } },
            children: [
              new TextRun({ text: 'Page ', size: 16, color: COLORS.medGray }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: COLORS.medGray }),
              new TextRun({ text: ' of ', size: 16, color: COLORS.medGray }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: COLORS.medGray }),
              new TextRun({ text: `  |  ${COMPANY.name}  |  CONFIDENTIAL`, size: 16, color: COLORS.medGray }),
            ],
          }),
        ],
      }),
    },
    children,
  }
}

// ─── Build & Save ───

/**
 * Build document and save to file
 * @param {object[]} sections - Array of section objects
 * @param {string} filename - Output filename (e.g., '01_System_Architecture_Guide.docx')
 * @returns {Promise<string>} - Output file path
 */
async function buildAndSave(sections, filename) {
  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const doc = new Document({
    styles: DOC_STYLES,
    numbering: NUMBERING_CONFIG,
    features: { updateFields: true },
    sections,
  })

  const buffer = await Packer.toBuffer(doc)
  const outputPath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(outputPath, buffer)

  const sizeKB = Math.round(buffer.length / 1024)
  console.log(`\u2705 Generated: ${filename} (${sizeKB} KB)`)
  console.log(`   Path: ${outputPath}`)

  return outputPath
}

// ─── Screenshot Path Resolver ───

/**
 * Resolve screenshot path from Operation_Manual subfolder
 * @param {string} subfolder - e.g., '7_Live_Inspection'
 * @param {string} filename - e.g., '1_Live_view_Select_Line.png'
 * @returns {string} - Absolute path
 */
function screenshot(subfolder, filename) {
  if (!subfolder) return path.join(SCREENSHOTS_DIR, filename)
  return path.join(SCREENSHOTS_DIR, subfolder, filename)
}

// ─── Exports ───
module.exports = {
  // Paths
  PROJECT_ROOT, SCREENSHOTS_DIR, HARDWARE_DIR, HARDWARE_IMAGES_DIR, MECH_IMAGES_DIR, OUTPUT_DIR, DOCS_DIR, CONTENT_WIDTH,
  // Colors & constants
  COLORS, FONT, BODY_SIZE, PAGE_A4, DOC_STYLES, NUMBERING_CONFIG,
  // Company branding
  COMPANY,
  // Table helpers
  styledTable, testTable, signOffTable,
  BORDERS_ALL, CELL_MARGINS, BORDER_THIN,
  // Image helpers
  embedScreenshot, figureCaption,
  // Structural helpers
  coverPage, revisionHistory, contentSection, tableOfContents,
  heading, bodyText, bullet, numberedStep, callout,
  // Build
  buildAndSave,
  // Screenshot resolver
  screenshot,
  // Re-export docx-js for generators
  docx: {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    ImageRun, Header, Footer, AlignmentType, HeadingLevel,
    LevelFormat, BorderStyle, WidthType, ShadingType, VerticalAlign,
    PageBreak, PageNumber, NumberFormat,
  },
}
