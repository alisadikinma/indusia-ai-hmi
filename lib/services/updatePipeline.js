/**
 * Update Pipeline Service
 *
 * Orchestrates the system update steps sequentially:
 * 1. SAFETY_CHECK — verify no production lines are running
 * 2. GIT_PULL — fetch + pull from origin
 * 3. NPM_INSTALL — install dependencies if package-lock changed
 * 4. RUN_MIGRATIONS — execute pending SQL migrations
 * 5. BUILD — npm run build
 * 6. RESTART — write .restart-trigger file
 *
 * Each step reports progress via onProgress callback.
 */

import { execSync, spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getAllLineStates } from '@/lib/services/lineStateStore'

const PROJECT_ROOT = process.cwd()
const isDev = process.env.NODE_ENV === 'development'

/**
 * Run a shell command and return stdout, or throw on failure
 */
function exec(cmd) {
  return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30000 }).trim()
}

/**
 * Run a spawned process and stream output line-by-line
 * Returns a promise that resolves with exit code
 */
function spawnAsync(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: PROJECT_ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach(line => onLine(line))
    })

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach(line => onLine(line))
    })

    proc.on('close', (code) => resolve(code))
    proc.on('error', (err) => reject(err))
  })
}

/**
 * Run the full update pipeline
 *
 * @param {Object} options
 * @param {string} options.fromVersion - Current version
 * @param {string} options.toVersion - Target version (for logging)
 * @param {Function} options.onProgress - Callback: (step, status, message) => void
 * @param {string} options.userId - User triggering the update
 * @param {boolean} [options.skipRestart=false] - Skip the restart step (dev mode auto-reload)
 * @returns {{ success, migrationsApplied, commitsPulled, error }}
 */
export async function runUpdatePipeline({ fromVersion, toVersion, onProgress, userId, skipRestart = false }) {
  const result = {
    success: false,
    migrationsApplied: 0,
    commitsPulled: 0,
    error: null,
  }

  try {
    // Step 1: SAFETY_CHECK
    onProgress('SAFETY_CHECK', 'running', 'Checking production line status...')

    const lineStates = getAllLineStates()
    const runningLines = lineStates
      .filter(([_, state]) => state.processStatus === 'RUNNING')
      .map(([lineId]) => lineId)

    if (runningLines.length > 0) {
      const msg = `Cannot update: ${runningLines.length} line(s) running (${runningLines.join(', ')}). Stop production first.`
      onProgress('SAFETY_CHECK', 'failed', msg)
      result.error = msg
      return result
    }

    onProgress('SAFETY_CHECK', 'done', 'All production lines idle')

    // Step 2: GIT_PULL
    onProgress('GIT_PULL', 'running', 'Fetching latest code from remote...')

    try {
      exec('git fetch origin --tags')
      onProgress('GIT_PULL', 'running', 'Pulling changes...')

      const pullOutput = exec('git pull origin main')
      onProgress('GIT_PULL', 'running', pullOutput)

      // Count commits pulled
      const countMatch = pullOutput.match(/(\d+) files? changed/)
      if (countMatch) {
        result.commitsPulled = parseInt(countMatch[1], 10)
      }
      if (pullOutput.includes('Already up to date')) {
        result.commitsPulled = 0
      }
    } catch (err) {
      const msg = `Git pull failed: ${err.message}`
      onProgress('GIT_PULL', 'failed', msg)
      result.error = msg
      return result
    }

    onProgress('GIT_PULL', 'done', `Code updated to ${toVersion} (${result.commitsPulled} files changed)`)

    // Step 3: NPM_INSTALL — always run after git pull to ensure deps are in sync
    onProgress('NPM_INSTALL', 'running', 'Installing dependencies...')

    const npmExitCode = await spawnAsync('npm', ['install'], (line) => {
      onProgress('NPM_INSTALL', 'running', line)
    })

    if (npmExitCode !== 0) {
      const msg = `npm install failed with exit code ${npmExitCode}`
      onProgress('NPM_INSTALL', 'failed', msg)
      result.error = msg
      return result
    }

    onProgress('NPM_INSTALL', 'done', 'Dependencies installed')

    // Step 4: RUN_MIGRATIONS — runs as subprocess to avoid webpack bundling issues
    onProgress('RUN_MIGRATIONS', 'running', 'Checking for pending SQL migrations...')

    if (!process.env.DATABASE_URL) {
      onProgress('RUN_MIGRATIONS', 'done', 'Skipped — DATABASE_URL not configured')
    } else {
      try {
        // Check pending migrations (subprocess with JSON output)
        const pendingJson = execSync(
          'node scripts/run-migrations.js --pending --json',
          { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 30000, env: { ...process.env } }
        ).trim()
        const pending = JSON.parse(pendingJson)

        if (pending.error) {
          throw new Error(pending.error)
        }

        if (pending.pending.length === 0) {
          onProgress('RUN_MIGRATIONS', 'done', 'No pending migrations — database is up to date')
        } else {
          onProgress('RUN_MIGRATIONS', 'running', `Found ${pending.pending.length} pending migration(s): ${pending.pending.join(', ')}`)

          // Run migrations (subprocess with JSON output)
          const migrateJson = execSync(
            `node scripts/run-migrations.js --json --user=${userId || 'ota-update'}`,
            { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 60000, env: { ...process.env } }
          ).trim()
          const migrationResult = JSON.parse(migrateJson)

          result.migrationsApplied = migrationResult.applied || 0

          if (migrationResult.errors && migrationResult.errors.length > 0) {
            const msg = `Migration errors: ${migrationResult.errors.map(e => e.error).join('; ')}`
            onProgress('RUN_MIGRATIONS', 'failed', msg)
            result.error = msg
            return result
          }

          onProgress('RUN_MIGRATIONS', 'done', `${result.migrationsApplied} migration(s) applied successfully`)
        }
      } catch (err) {
        const msg = `Migration runner error: ${err.message}`
        onProgress('RUN_MIGRATIONS', 'failed', msg)
        result.error = msg
        return result
      }
    }

    // Step 5: BUILD (skip in dev — dev server auto-recompiles on file changes)
    if (isDev) {
      onProgress('BUILD', 'running', 'Development mode — skipping production build')
      onProgress('BUILD', 'done', 'Skipped (dev server will auto-reload)')
    } else {
      onProgress('BUILD', 'running', 'Clearing build cache...')

      const nextDir = path.join(PROJECT_ROOT, '.next')
      if (fs.existsSync(nextDir)) {
        fs.rmSync(nextDir, { recursive: true, force: true })
        onProgress('BUILD', 'running', 'Build cache cleared')
      }

      onProgress('BUILD', 'running', 'Building application...')

      const buildExitCode = await spawnAsync('npm', ['run', 'build'], (line) => {
        onProgress('BUILD', 'running', line)
      })

      if (buildExitCode !== 0) {
        const msg = `Build failed with exit code ${buildExitCode}`
        onProgress('BUILD', 'failed', msg)
        result.error = msg
        return result
      }

      onProgress('BUILD', 'done', 'Build completed successfully')
    }

    // Step 6: RESTART
    if (skipRestart || isDev) {
      onProgress('RESTART', 'running', 'Skipping server restart')
      onProgress('RESTART', 'done', isDev
        ? 'Skipped — dev server auto-reloads on file changes'
        : 'Skipped — restart disabled by user')
    } else {
      onProgress('RESTART', 'running', 'Sending restart signal...')

      const triggerFile = path.join(PROJECT_ROOT, '.restart-trigger')
      fs.writeFileSync(triggerFile, JSON.stringify({
        version: toVersion,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
      }))

      onProgress('RESTART', 'done', 'Restart signal sent. Server will restart in ~5 seconds.')
    }

    // Final: bump package.json version ONLY after all steps succeed
    const targetSemver = toVersion.replace(/^v/, '')
    try {
      const pkgPath = path.join(PROJECT_ROOT, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.version !== targetSemver) {
        pkg.version = targetSemver
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
        onProgress('RESTART', 'running', `Updated package.json version to ${targetSemver}`)
      }
    } catch (err) {
      onProgress('RESTART', 'running', `Warning: Could not update package.json version: ${err.message}`)
    }

    result.success = true
    return result

  } catch (err) {
    result.error = `Pipeline error: ${err.message}`
    onProgress('ERROR', 'failed', result.error)
    return result
  }
}
