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
 * @returns {{ success, migrationsApplied, commitsPulled, error }}
 */
export async function runUpdatePipeline({ fromVersion, toVersion, onProgress, userId }) {
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

    onProgress('GIT_PULL', 'done', `Code updated (${result.commitsPulled} files changed)`)

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

    // Step 4: RUN_MIGRATIONS
    onProgress('RUN_MIGRATIONS', 'running', 'Running database migrations...')

    try {
      const { runMigrations } = require('../../scripts/run-migrations')
      const migrationResult = await runMigrations(userId || 'ota-update')

      result.migrationsApplied = migrationResult.applied

      if (migrationResult.errors.length > 0) {
        const msg = `Migration errors: ${migrationResult.errors.map(e => e.error).join('; ')}`
        onProgress('RUN_MIGRATIONS', 'failed', msg)
        result.error = msg
        return result
      }
    } catch (err) {
      const msg = `Migration runner error: ${err.message}`
      onProgress('RUN_MIGRATIONS', 'failed', msg)
      result.error = msg
      return result
    }

    onProgress('RUN_MIGRATIONS', 'done', `${result.migrationsApplied} migration(s) applied`)

    // Step 5: BUILD
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

    // Step 6: RESTART
    onProgress('RESTART', 'running', 'Sending restart signal...')

    const triggerFile = path.join(PROJECT_ROOT, '.restart-trigger')
    fs.writeFileSync(triggerFile, JSON.stringify({
      version: toVersion,
      timestamp: new Date().toISOString(),
      triggeredBy: userId,
    }))

    onProgress('RESTART', 'done', 'Restart signal sent. Server will restart in ~5 seconds.')

    result.success = true
    return result

  } catch (err) {
    result.error = `Pipeline error: ${err.message}`
    onProgress('ERROR', 'failed', result.error)
    return result
  }
}
