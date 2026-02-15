import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const PROJECT_ROOT = process.cwd()

/**
 * Get current version from package.json
 */
export function getCurrentVersion() {
  const pkgPath = path.join(PROJECT_ROOT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  return pkg.version
}

/**
 * Get build info from git + package.json
 * Returns { version, branch, commitHash, buildDate }
 */
export function getBuildInfo() {
  const version = getCurrentVersion()
  let branch = 'unknown'
  let commitHash = 'unknown'

  try {
    branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim()
  } catch (_) { /* git not available */ }

  try {
    commitHash = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim()
  } catch (_) { /* git not available */ }

  return {
    version,
    branch,
    commitHash,
    buildDate: new Date().toISOString(),
  }
}

/**
 * Compare two semver strings (e.g. "1.2.3" or "v1.2.3")
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a, b) {
  const parse = (v) => v.replace(/^v/, '').split('.').map(Number)
  const partsA = parse(a)
  const partsB = parse(b)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA < numB) return -1
    if (numA > numB) return 1
  }
  return 0
}
