/**
 * OpenAPI Spec Endpoint
 * GET /api/docs/spec - Returns OpenAPI specification as JSON
 */

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

export async function GET() {
  try {
    // Read the YAML spec file
    const specPath = path.join(process.cwd(), 'docs', 'swagger', 'ai-backend-api.yaml')
    
    if (!fs.existsSync(specPath)) {
      return NextResponse.json(
        { error: 'OpenAPI spec file not found', path: specPath },
        { status: 404 }
      )
    }

    const yamlContent = fs.readFileSync(specPath, 'utf8')
    const spec = YAML.parse(yamlContent)

    return NextResponse.json(spec, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error)
    return NextResponse.json(
      { error: 'Failed to load OpenAPI specification', details: error.message },
      { status: 500 }
    )
  }
}
