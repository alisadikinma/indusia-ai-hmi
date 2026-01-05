import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { withAuth } from '@/lib/auth/apiAuth'
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo'

const LOCAL_STORAGE_PATH = process.env.FALSE_CALL_STORAGE_PATH || 'D:/Projects/indusia-ai-hmi/storage/false-calls'
const SUPABASE_BUCKET = 'false-calls'

/**
 * GET /api/sync/cloud
 * Get sync queue summary and pending items
 */
async function handleGET(request) {
  try {
    const summaryResult = await syncQueueRepo.getQueueSummary()
    const pendingResult = await syncQueueRepo.getPendingItems(50)
    
    return NextResponse.json({
      success: true,
      summary: summaryResult.data || { pendingCount: 0, syncedCount: 0, failedCount: 0 },
      pending: pendingResult.data || [],
      pendingCount: pendingResult.count || 0
    })
  } catch (error) {
    console.error('[GET /api/sync/cloud] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/sync/cloud
 * Upload pending items to Supabase Storage
 * Body: { itemIds?: string[] } - optional specific IDs, otherwise sync all pending
 */
async function handlePOST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ 
      success: false, 
      error: 'Supabase not configured' 
    }, { status: 500 })
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  const user = request.user
  
  try {
    const body = await request.json().catch(() => ({}))
    const { itemIds } = body
    
    // Get pending items
    let items = []
    if (itemIds?.length) {
      const result = await syncQueueRepo.getPendingItems(100)
      items = (result.data || []).filter(item => itemIds.includes(item.id))
    } else {
      const result = await syncQueueRepo.getPendingItems(100)
      items = result.data || []
    }
    
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending items', synced: 0, failed: 0 })
    }
    
    console.log(`[POST /api/sync/cloud] Starting sync of ${items.length} items...`)
    const startTime = Date.now()
    const results = { synced: 0, failed: 0, errors: [] }
    
    // Mark items as syncing
    await syncQueueRepo.markAsSyncing(items.map(i => i.id))
    
    for (const item of items) {
      try {
        const localPath = item.local_image_path || item.localImagePath
        if (!localPath) throw new Error('No local path')
        
        // Read local file
        const fullLocalPath = path.join(LOCAL_STORAGE_PATH, localPath)
        const fileBuffer = await fs.readFile(fullLocalPath)
        
        // Upload to Supabase Storage
        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(localPath, fileBuffer, { contentType: 'image/png', upsert: true })
        
        if (error) throw error
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(localPath)
        
        // Mark as synced
        await syncQueueRepo.markAsSynced(item.id, {
          imagePath: localPath,
          publicUrl: urlData?.publicUrl
        }, user?.id)
        
        results.synced++
        console.log(`[Sync] ✅ ${localPath}`)
      } catch (err) {
        console.error(`[Sync] ❌`, item.id, err.message)
        await syncQueueRepo.markAsFailed(item.id, err.message)
        results.failed++
        results.errors.push({ id: item.id, error: err.message })
      }
    }
    
    const duration = Date.now() - startTime
    
    // Record sync history
    await syncQueueRepo.addSyncHistory({
      recordCount: items.length,
      successCount: results.synced,
      failedCount: results.failed,
      status: results.failed === 0 ? 'completed' : results.synced === 0 ? 'failed' : 'partial',
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: duration,
      triggeredBy: user?.id
    })
    
    console.log(`[Sync] Complete: ${results.synced}/${items.length} in ${duration}ms`)
    
    return NextResponse.json({
      success: true,
      synced: results.synced,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined,
      duration
    })
    
  } catch (error) {
    console.error('[POST /api/sync/cloud] Error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export const GET = withAuth('sync:read')(handleGET)
export const POST = withAuth('sync:execute')(handlePOST)
