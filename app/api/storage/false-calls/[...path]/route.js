import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || 'D:/Projects/indusia-ai-hmi/storage/false-calls';

/**
 * GET /api/storage/false-calls/[...path]
 * Serve false call images from local storage
 */
export async function GET(request, { params }) {
  try {
    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      );
    }

    // Join path segments and sanitize
    const relativePath = pathSegments.join('/');
    
    // Prevent directory traversal
    if (relativePath.includes('..')) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    const fullPath = path.join(LOCAL_STORAGE_PATH, relativePath);

    // Check file exists
    if (!existsSync(fullPath)) {
      console.log('[Storage API] File not found:', fullPath);
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(fullPath);

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Return file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Storage API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
