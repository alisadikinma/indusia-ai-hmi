import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Local storage path for false call images
const LOCAL_STORAGE_PATH = process.env.FALSE_CALL_STORAGE_PATH || 'D:/Projects/indusia-ai-hmi/storage/false-calls'

/**
 * POST /api/inspection/upload-false-call
 * Save false call images to LOCAL storage only
 *
 * Flow:
 * 1. Operator confirms false call → images saved locally here
 * 2. Override record created with local_image_path + ng_frame_details
 * 3. Manager approves → added to sync_queue
 * 4. Manager clicks "Sync to Cloud" → uploads to Supabase Storage
 *
 * Supports two modes:
 * - Legacy: saves annotated images for all defect frames
 * - Per-frame: accepts perFrameDecisions, saves annotated + raw for false call frames only
 */
export async function POST(request) {
  console.log('[UploadFalseCall] Saving to LOCAL storage...')

  try {
    const body = await request.json()
    const { inspection, workOrder, customerName, boardSequence, falseCallReason, perFrameDecisions } = body

    console.log('[UploadFalseCall] WO:', workOrder?.woNumber, 'Customer:', customerName)
    if (perFrameDecisions) {
      console.log('[UploadFalseCall] Per-frame decisions:', Object.keys(perFrameDecisions).length, 'frames')
    }

    if (!inspection?.results) {
      return NextResponse.json({ success: false, error: 'No inspection results' }, { status: 400 })
    }

    const now = new Date()
    const timestamp = formatTimestamp(now)
    const dateFolder = formatDateFolder(now)

    const sanitize = (str) => (str || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)
    const customer = sanitize(customerName)
    const wo = sanitize(workOrder?.woNumber)
    const board = sanitize(boardSequence)
    const reason = sanitize(falseCallReason)

    const savedPaths = { top: [], bottom: [] }
    const frameDetails = []
    const errors = []

    // Helper: check if frame has defects (label=1)
    const hasDefects = (frame) => {
      const objects = frame?.objects || []
      return objects.some(obj => obj.label === 1)
    }

    // Helper: check if frame is a false call (operator says GOOD but AI said NG)
    const isFalseCall = (side, frameIndex) => {
      if (!perFrameDecisions) return null // legacy mode
      const key = `${side}-${frameIndex}`
      const decision = perFrameDecisions[key]
      // REAL_NG = confirmed defect (not a false call), everything else = false call reason
      return decision && decision !== 'REAL_NG' ? decision : null
    }

    // Helper: save image to local filesystem
    const saveToLocal = async (imageUrl, relativePath, label) => {
      try {
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Fetch failed: ${imageResponse.status}`)
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

        const fullPath = path.join(LOCAL_STORAGE_PATH, relativePath)
        const dirPath = path.dirname(fullPath)
        await fs.mkdir(dirPath, { recursive: true })
        await fs.writeFile(fullPath, imageBuffer)

        console.log(`[UploadFalseCall] ✅ Saved ${label}: ${relativePath}`)
        return { success: true, localPath: relativePath }
      } catch (err) {
        console.error(`[UploadFalseCall] ❌ Save ${label} failed:`, err.message)
        return { success: false, error: err.message }
      }
    }

    // Process frames for a given side
    const processSide = async (sideKey, sideLabel) => {
      const frames = Array.isArray(inspection.results[sideKey])
        ? inspection.results[sideKey]
        : inspection.results[sideKey]?.image_url ? [inspection.results[sideKey]] : []

      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]
        if (!frame?.image_url) continue

        // Determine if this frame should be saved
        const falseCallDecision = isFalseCall(sideLabel, i)

        if (perFrameDecisions) {
          // New mode: only save false call frames (skip REAL_NG and frames without decisions)
          if (!falseCallDecision) continue
        } else {
          // Legacy mode: save frames with defects
          if (!hasDefects(frame)) continue
        }

        const frameIdx = `_F${i}`
        const baseFilename = `${timestamp}_${sideLabel}${frameIdx}_${customer}_${wo}_${board}`

        // Save annotated image (AI bbox overlay)
        const annotatedFilename = `${baseFilename}_${reason}.png`
        const annotatedPath = `${dateFolder}/${wo}/${annotatedFilename}`
        const annotatedResult = await saveToLocal(frame.image_url, annotatedPath, `${sideLabel} F${i} annotated`)

        // Save raw image (original camera capture) - new mode only
        let rawResult = null
        if (perFrameDecisions && frame.image_raw_url) {
          const rawFilename = `${baseFilename}_raw.png`
          const rawPath = `${dateFolder}/${wo}/${rawFilename}`
          rawResult = await saveToLocal(frame.image_raw_url, rawPath, `${sideLabel} F${i} raw`)
        }

        if (annotatedResult.success) {
          const pathEntry = { path: annotatedResult.localPath, frameIndex: i }
          if (rawResult?.success) {
            pathEntry.rawPath = rawResult.localPath
          }
          savedPaths[sideKey].push(pathEntry)

          // Build frame detail for ng_frame_details
          if (perFrameDecisions) {
            frameDetails.push({
              side: sideLabel,
              frameIndex: i,
              position: frame.position ?? null,
              serialNumber: frame.serial_number || null,
              falseCallReason: falseCallDecision,
              imageAnnotatedPath: annotatedResult.localPath,
              imageRawPath: rawResult?.success ? rawResult.localPath : null,
              objects: (frame.objects || [])
                .filter(obj => obj.label === 1)
                .map(obj => ({
                  name: obj.name,
                  box: obj.box,
                  score: obj.score,
                  label: obj.label
                }))
            })
          }
        } else {
          errors.push(`${sideLabel} F${i}: ${annotatedResult.error}`)
        }
      }
    }

    await processSide('top', 'TOP')
    await processSide('bottom', 'BOTTOM')

    const totalSaved = savedPaths.top.length + savedPaths.bottom.length

    if (totalSaved === 0 && errors.length === 0) {
      return NextResponse.json({
        success: true,
        paths: savedPaths,
        frameDetails: [],
        message: 'No false call frames to save'
      })
    }

    console.log(`[UploadFalseCall] Complete: ${totalSaved} saved locally, ${frameDetails.length} frame details`)

    return NextResponse.json({
      success: totalSaved > 0,
      paths: savedPaths,
      frameDetails: frameDetails.length > 0 ? frameDetails : undefined,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${totalSaved} images locally`
    })

  } catch (error) {
    console.error('[UploadFalseCall] Server error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

function formatTimestamp(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${h}${min}${s}`
}

function formatDateFolder(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}
