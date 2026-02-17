/**
 * SQL Migration Runner
 *
 * Scans the migrations/ folder for numbered SQL files and executes any
 * that haven't been applied yet. Tracks applied migrations in the
 * schema_migrations table.
 *
 * Usage:
 *   Standalone:  node scripts/run-migrations.js
 *   As module:   const { runMigrations, getPendingMigrations } = require('./scripts/run-migrations')
 *
 * Requires DATABASE_URL environment variable.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Use process.cwd() so it works both standalone and when imported by webpack-bundled API routes
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

/**
 * Parse migration filename to extract version number.
 * Expected format: 001_description.sql -> version 1
 */
function parseVersion(filename) {
  const match = filename.match(/^(\d+)[_-]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Get a PostgreSQL client connected to the database.
 */
function getClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required. Set it in .env.local');
  }
  return new Client({ connectionString: databaseUrl });
}

/**
 * Check if schema_migrations table exists, create if not.
 */
async function ensureMigrationsTable(client) {
  const result = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS exists"
  );

  if (!result.rows[0].exists) {
    // Bootstrap: read and execute the first migration directly
    const bootstrapSql = fs.readFileSync(
      path.join(MIGRATIONS_DIR, '001_create_schema_migrations.sql'),
      'utf-8'
    );
    await client.query(bootstrapSql);

    // Record that migration 001 has been applied
    await client.query(
      'INSERT INTO schema_migrations (version, filename, applied_by) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING',
      [1, '001_create_schema_migrations.sql', 'bootstrap']
    );

    console.log('  [bootstrap] Created schema_migrations table');
    return true;
  }
  return false;
}

/**
 * Get list of already-applied migration versions.
 */
async function getAppliedVersions(client) {
  const result = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(result.rows.map(r => r.version));
}

/**
 * Scan migrations/ folder and return sorted list of migration files.
 */
function scanMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(filename => ({
      filename,
      version: parseVersion(filename),
      filepath: path.join(MIGRATIONS_DIR, filename),
    }))
    .filter(m => m.version !== null)
    .sort((a, b) => a.version - b.version);
}

/**
 * Get list of pending migrations without executing them (dry-run).
 * Can be called without a database connection for file-only scanning.
 */
async function getPendingMigrations() {
  const allMigrations = scanMigrationFiles();

  // Try to check against DB, fall back to returning all if no connection
  let appliedVersions = new Set();
  let client;

  try {
    client = getClient();
    await client.connect();

    // Check if table exists first
    const tableCheck = await client.query(
      "SELECT to_regclass('public.schema_migrations') AS exists"
    );

    if (tableCheck.rows[0].exists) {
      appliedVersions = await getAppliedVersions(client);
    }
  } catch (err) {
    // Can't connect to DB — return all as pending
    console.warn('[migrations] Could not connect to DB for pending check:', err.message);
  } finally {
    if (client) {
      await client.end().catch(() => {});
    }
  }

  const pending = allMigrations.filter(m => !appliedVersions.has(m.version));

  return {
    pending: pending.map(m => m.filename),
    applied: appliedVersions.size,
    total: allMigrations.length,
  };
}

/**
 * Run all pending migrations.
 * @param {string} appliedBy - User identifier for audit trail
 * @returns {{ applied: number, errors: Array<{filename: string, error: string}> }}
 */
async function runMigrations(appliedBy = 'system') {
  const client = getClient();
  const result = { applied: 0, errors: [] };

  try {
    await client.connect();
    console.log('[migrations] Connected to database');

    // Ensure schema_migrations table exists
    await ensureMigrationsTable(client);

    // Get already-applied versions
    const appliedVersions = await getAppliedVersions(client);
    console.log(`[migrations] ${appliedVersions.size} migration(s) already applied`);

    // Scan for all migration files
    const allMigrations = scanMigrationFiles();
    const pending = allMigrations.filter(m => !appliedVersions.has(m.version));

    if (pending.length === 0) {
      console.log(`[migrations] 0 migrations to apply, ${appliedVersions.size} already up to date`);
      return result;
    }

    console.log(`[migrations] ${pending.length} pending migration(s) to apply`);

    // Execute each pending migration
    for (const migration of pending) {
      try {
        const sql = fs.readFileSync(migration.filepath, 'utf-8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, filename, applied_by) VALUES ($1, $2, $3)',
          [migration.version, migration.filename, appliedBy]
        );
        await client.query('COMMIT');

        result.applied++;
        console.log(`  [✓] ${migration.filename}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const errorMsg = `Migration ${migration.filename} failed: ${err.message}`;
        result.errors.push({ filename: migration.filename, error: err.message });
        console.error(`  [✗] ${errorMsg}`);
        // Stop on first error — don't apply subsequent migrations
        break;
      }
    }

    const status = result.errors.length > 0 ? 'with errors' : 'successfully';
    console.log(`[migrations] ${result.applied} migration(s) applied ${status}, ${appliedVersions.size + result.applied} total`);

  } catch (err) {
    console.error('[migrations] Fatal error:', err.message);
    result.errors.push({ filename: 'connection', error: err.message });
  } finally {
    await client.end().catch(() => {});
  }

  return result;
}

// Export for use as module
module.exports = { runMigrations, getPendingMigrations, scanMigrationFiles };

/**
 * Load .env.local for standalone execution
 */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex);
          const value = trimmed.substring(eqIndex + 1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

// Run standalone if called directly
// Modes: --json (run + JSON output), --pending (check pending + JSON output), default (run + console)
if (require.main === module) {
  loadEnv();

  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const pendingMode = args.includes('--pending');
  const appliedBy = args.find(a => a.startsWith('--user='))?.split('=')[1] || 'cli';

  // In JSON mode, suppress all console.log/warn/error to keep stdout clean for JSON
  if (jsonMode) {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = (...a) => process.stderr.write(a.join(' ') + '\n');
    console.warn = (...a) => process.stderr.write(a.join(' ') + '\n');
    console.error = (...a) => process.stderr.write(a.join(' ') + '\n');
  }

  if (pendingMode) {
    getPendingMigrations()
      .then(result => {
        if (jsonMode) {
          process.stdout.write(JSON.stringify(result));
        } else {
          console.log(`Pending: ${result.pending.length}, Applied: ${result.applied}, Total: ${result.total}`);
          result.pending.forEach(f => console.log(`  - ${f}`));
        }
      })
      .catch(err => {
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ error: err.message }));
        } else {
          console.error('Failed:', err);
        }
        process.exit(1);
      });
  } else {
    runMigrations(appliedBy)
      .then(result => {
        if (jsonMode) {
          process.stdout.write(JSON.stringify(result));
        }
        if (result.errors.length > 0) {
          process.exit(1);
        }
      })
      .catch(err => {
        if (jsonMode) {
          process.stdout.write(JSON.stringify({ applied: 0, errors: [{ filename: 'fatal', error: err.message }] }));
        } else {
          console.error('Migration runner failed:', err);
        }
        process.exit(1);
      });
  }
}
