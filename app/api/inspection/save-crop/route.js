import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/inspection/save-crop
 * Save cropped defect image to local folder
 * 
 * Body:
 * - imageData: base64 encoded image (data:image/png;base64,...)
 * - boardId: board identifier
 * - defectIndex: defect number
 * - defectType: type of defect
 * - side: TOP or BOTTOM
 * - woNumber: work order number
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { imageData, boardId, defectIndex, defectType, side, woNumber } = body;

    if (!imageData || !boardId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Extract base64 data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Build folder path: public/crops/{woNumber}/{date}/
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const folderPath = path.join(
      process.cwd(),
      'public',
      'crops',
      woNumber || 'unknown',
      today
    );

    // Create directory if not exists
    await mkdir(folderPath, { recursive: true });

    // Build filename: {boardId}_{side}_{defectIndex}_{defectType}.png
    const sanitizedDefectType = (defectType || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    
    const filename = `${boardId}_${side || 'TOP'}_${defectIndex || 0}_${sanitizedDefectType}.png`;
    const filePath = path.join(folderPath, filename);

    // Write file
    await writeFile(filePath, buffer);

    // Return relative path for reference
    const relativePath = `/crops/${woNumber || 'unknown'}/${today}/${filename}`;

    console.log('[SaveCrop] Saved:', relativePath);

    return NextResponse.json({
      success: true,
      data: {
        filePath: relativePath,
        fullPath: filePath,
        filename,
      }
    });

  } catch (error) {
    console.error('[SaveCrop] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
