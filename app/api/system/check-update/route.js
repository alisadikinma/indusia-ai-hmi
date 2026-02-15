import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/apiAuth'
import { execSync } from 'child_process'
import { getCurrentVersion, compareVersions } from '@/lib/utils/version'

const PROJECT_ROOT = process.cwd()

/**
 * Run a git command and return trimmed output, or null on failure
 */
function gitExec(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 15000 }).trim()
  } catch (_) {
    return null
  }
}

async function handleGET(request) {
  // Superadmin-only check (system:update permission doesn't exist yet)
  if (request.user.role_id !== 'role_superadmin') {
    return NextResponse.json(
      { success: false, error: 'Forbidden — superadmin only' },
      { status: 403 }
    )
  }

  try {
    const currentVersion = getCurrentVersion()

    // Fetch latest tags from remote
    const fetchResult = gitExec('git fetch origin --tags 2>&1')
    if (fetchResult === null) {
      return NextResponse.json({
        success: true,
        data: {
          currentVersion,
          latestVersion: null,
          isUpdateAvailable: false,
          commitsBehind: 0,
          changelog: [],
          error: 'Could not fetch from remote. Check network and git remote configuration.',
        },
      })
    }

    // Get current tag (local)
    const currentTag = gitExec('git describe --tags --abbrev=0') || `v${currentVersion}`

    // Get latest tag from remote
    const latestTag = gitExec('git tag --sort=-v:refname')
    const latestVersion = latestTag ? latestTag.split('\n')[0] : currentTag

    // Count commits between current tag and latest tag
    let commitsBehind = 0
    if (currentTag !== latestVersion) {
      const count = gitExec(`git rev-list ${currentTag}..${latestVersion} --count`)
      commitsBehind = count ? parseInt(count, 10) : 0
    }

    // Get changelog between versions
    let changelog = []
    if (commitsBehind > 0) {
      const log = gitExec(`git log ${currentTag}..${latestVersion} --oneline --format=%s`)
      if (log) {
        changelog = log.split('\n').filter(Boolean)
      }
    }

    const isUpdateAvailable = compareVersions(latestVersion, currentTag) > 0

    return NextResponse.json({
      success: true,
      data: {
        currentVersion,
        latestVersion: latestVersion.replace(/^v/, ''),
        isUpdateAvailable,
        commitsBehind,
        changelog,
      },
    })
  } catch (error) {
    console.error('[Check-Update API] Error:', error.message)
    return NextResponse.json(
      { success: false, error: 'Failed to check for updates' },
      { status: 500 }
    )
  }
}

// withAuth() ensures user is authenticated; role check is inside handler
export const GET = withAuth()(handleGET)
