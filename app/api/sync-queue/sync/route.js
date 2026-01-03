/**
 * Sync Execution API
 * POST /api/sync-queue/sync - Execute sync to Supabase Storage
 * 
 * Uploads local images to Supabase Storage bucket for AI training
 */

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';
import { syncQueueRepo } from '@/lib/repos/syncQueueRepo';

const TRAINING_BUCKET = 'training-data';

export async function POST(request) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { userId, itemIds } = body;

    // Get pending items (or specific items if IDs provided)
    let itemsResult;
    if (itemIds && itemIds.length > 0) {
      // Sync specific items
      const { data, error } = await supabase
        .from('sync_queue')
        .select('*')
        .in('id', itemIds)
        .eq('status', 'pending');
      
      itemsResult = { success: !error, data, error: error?.message };
    } else {
      // Sync all pending
      itemsResult = await syncQueueRepo.getPendingItems();
    }

    if (!itemsResult.success) {
      return NextResponse.json(
        { success: false, error: itemsResult.error },
        { status: 500 }
      );
    }

    const items = itemsResult.data || [];
    
    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No pending items to sync',
          syncedCount: 0,
          failedCount: 0,
        },
      });
    }

    // Mark all as syncing
    await syncQueueRepo.markAsSyncing(items.map(i => i.id));

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each item
    for (const item of items) {
      try {
        const cloudPaths = {};

        // Upload full image if exists
        if (item.local_image_path) {
          const localPath = path.join(process.cwd(), 'public', item.local_image_path);
          
          if (existsSync(localPath)) {
            const fileBuffer = await readFile(localPath);
            const cloudPath = `false-calls/${item.board_id}/${path.basename(item.local_image_path)}`;
            
            const { error: uploadError } = await supabase.storage
              .from(TRAINING_BUCKET)
              .upload(cloudPath, fileBuffer, {
                contentType: 'image/png',
                upsert: true,
              });

            if (uploadError) {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }

            cloudPaths.imagePath = cloudPath;
          }
        }

        // Upload crop image if exists
        if (item.local_crop_path) {
          const localCropPath = path.join(process.cwd(), 'public', item.local_crop_path);
          
          if (existsSync(localCropPath)) {
            const cropBuffer = await readFile(localCropPath);
            const cloudCropPath = `false-calls/${item.board_id}/crops/${path.basename(item.local_crop_path)}`;
            
            const { error: cropUploadError } = await supabase.storage
              .from(TRAINING_BUCKET)
              .upload(cloudCropPath, cropBuffer, {
                contentType: 'image/png',
                upsert: true,
              });

            if (cropUploadError) {
              throw new Error(`Crop upload failed: ${cropUploadError.message}`);
            }

            cloudPaths.cropPath = cloudCropPath;
          }
        }

        // Mark as synced
        await syncQueueRepo.markAsSynced(item.id, cloudPaths, userId);
        successCount++;
        
        results.push({
          id: item.id,
          boardId: item.board_id,
          status: 'synced',
          cloudPaths,
        });

      } catch (itemError) {
        console.error(`[Sync] Failed to sync item ${item.id}:`, itemError);
        await syncQueueRepo.markAsFailed(item.id, itemError.message);
        failedCount++;
        
        results.push({
          id: item.id,
          boardId: item.board_id,
          status: 'failed',
          error: itemError.message,
        });
      }
    }

    // Record sync history
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    
    await syncQueueRepo.addSyncHistory({
      recordCount: items.length,
      successCount,
      failedCount,
      status: failedCount === 0 ? 'success' : (successCount === 0 ? 'failed' : 'partial'),
      startedAt: new Date(startTime).toISOString(),
      completedAt,
      durationMs,
      triggeredBy: userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalCount: items.length,
        syncedCount: successCount,
        failedCount,
        durationMs,
        results,
      },
    });

  } catch (error) {
    console.error('[API] POST /api/sync-queue/sync error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
