import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

// Local storage path for false call images
const LOCAL_STORAGE_PATH = process.env.FALSE_CALL_STORAGE_PATH || 'D:/Projects/indusia-ai-hmi/storage/false-calls'

/**
 * POST /api/inspection/upload-false-call
 * Save false call images to LOCAL storage (not cloud)
 * Cloud sync happens later via Manager's "Sync to Cloud" action
 */
export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('[UploadFalseCall] Saving to LOCAL storage...')
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: 'Missing Supabase credentials' }, { status: 500 })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  try {
    const body = await request.json()
    const { inspection, workOrder, customerName, boardSequence, falseCallReason, inspectionResultId } = body
    
    console.log('[UploadFalseCall] WO:', workOrder?.woNumber, 'Customer:', customerName)

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
    const pendingSync = [] // Track for cloud sync
    const errors = []

    // Helper: check if frame has defects (label=1)
    const hasDefects = (frame) => {
      const objects = frame?.objects || []
      return objects.some(obj => obj.label === 1)
    }

    // Helper: save to local filesystem
    const saveToLocal = async (imageUrl, relativePath, side, frameIndex) => {
      try {
        console.log(`[UploadFalseCall] Saving ${side} frame ${frameIndex} locally...`)
        
        // Fetch image from AI Backend
        const imageResponse = await fetch(imageUrl)
        if (!imageResponse.ok) {
          throw new Error(`Fetch failed: ${imageResponse.status}`)
        }
        
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
        
        // Create full path
        const fullPath = path.join(LOCAL_STORAGE_PATH, relativePath)
        const dirPath = path.dirname(fullPath)
        
        // Ensure directory exists
        await fs.mkdir(dirPath, { recursive: true })
        
        // Write file
        await fs.writeFile(fullPath, imageBuffer)
        
        console.log(`[UploadFalseCall] ✅ Saved locally: ${relativePath}`)
        return { success: true, localPath: relativePath }
        
      } catch (err) {
        console.error(`[UploadFalseCall] ❌ Save failed:`, err.message)
        return { success: false, error: err.message }
      }
    }

    // Process TOP side images - only frames with defects
    const topFrames = Array.isArray(inspection.results.top)
      ? inspection.results.top
      : inspection.results.top?.image_url ? [inspection.results.top] : []
    
    const topDefectFrames = topFrames.filter(hasDefects)
    console.log(`[UploadFalseCall] TOP: ${topFrames.length} frames, ${topDefectFrames.length} with defects`)

    for (let i = 0; i < topDefectFrames.length; i++) {
      const frame = topDefectFrames[i]
      if (!frame?.image_url) continue

      const frameIdx = topDefectFrames.length > 1 ? `_F${i + 1}` : ''
      const filename = `${timestamp}_TOP${frameIdx}_${customer}_${wo}_${board}_${reason}.png`
      const relativePath = `${dateFolder}/${wo}/${filename}`

      const result = await saveToLocal(frame.image_url, relativePath, 'TOP', i)
      
      if (result.success) {
        savedPaths.top.push({ path: result.localPath, frameIndex: i })
        pendingSync.push({
          localPath: result.localPath,
          cloudPath: `false-calls/${relativePath}`,
          side: 'TOP',
          frameIndex: i
        })
      } else {
        errors.push(`TOP ${i + 1}: ${result.error}`)
      }
    }

    // Process BOTTOM side images - only frames with defects
    const bottomFrames = Array.isArray(inspection.results.bottom)
      ? inspection.results.bottom
      : inspection.results.bottom?.image_url ? [inspection.results.bottom] : []
    
    const bottomDefectFrames = bottomFrames.filter(hasDefects)
    console.log(`[UploadFalseCall] BOTTOM: ${bottomFrames.length} frames, ${bottomDefectFrames.length} with defects`)

    for (let i = 0; i < bottomDefectFrames.length; i++) {
      const frame = bottomDefectFrames[i]
      if (!frame?.image_url) continue

      const frameIdx = bottomDefectFrames.length > 1 ? `_F${i + 1}` : ''
      const filename = `${timestamp}_BOTTOM${frameIdx}_${customer}_${wo}_${board}_${reason}.png`
      const relativePath = `${dateFolder}/${wo}/${filename}`

      const result = await saveToLocal(frame.image_url, relativePath, 'BOTTOM', i)
      
      if (result.success) {
        savedPaths.bottom.push({ path: result.localPath, frameIndex: i })
        pendingSync.push({
          localPath: result.localPath,
          cloudPath: `false-calls/${relativePath}`,
          side: 'BOTTOM',
          frameIndex: i
        })
      } else {
        errors.push(`BOTTOM ${i + 1}: ${result.error}`)
      }
    }

    // Save pending sync records to database
    if (pendingSync.length > 0) {
      console.log(`[UploadFalseCall] Recording ${pendingSync.length} images for cloud sync...`)
      try {
        const { error: insertError } = await supabase
          .from('pending_cloud_sync')
          .insert(pendingSync.map(p => ({
            local_path: p.localPath,
            cloud_path: p.cloudPath,
            side: p.side,
            frame_index: p.frameIndex,
            work_order_id: workOrder?.id,
            wo_number: wo,
            customer: customer,
            reason: reason,
            inspection_result_id: inspectionResultId,
            status: 'pending',
            created_at: now.toISOString()
          })))
        
        if (insertError) {
          console.error('[UploadFalseCall] Failed to record pending sync:', insertError)
        } else {
          console.log(`[UploadFalseCall] ✅ Recorded ${pendingSync.length} for cloud sync`)
        }
      } catch (dbErr) {
        console.error('[UploadFalseCall] DB error:', dbErr)
      }
    }

    const totalDefectFrames = topDefectFrames.length + bottomDefectFrames.length
    const totalSaved = savedPaths.top.length + savedPaths.bottom.length

    if (totalDefectFrames === 0) {
      return NextResponse.json({ 
        success: true, 
        paths: savedPaths, 
        message: 'No defect frames to save' 
      })
    }

    console.log(`[UploadFalseCall] Complete: ${totalSaved}/${totalDefectFrames} saved locally`)

    return NextResponse.json({
      success: totalSaved > 0,
      paths: savedPaths,
      pendingSync: pendingSync.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${totalSaved} images locally. Use "Sync to Cloud" to upload.`
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
