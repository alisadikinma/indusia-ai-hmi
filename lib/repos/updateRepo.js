/**
 * Update Repository
 * Handles update_log and schema_migrations queries via PostgREST.
 * Uses the migration runner for pending migration scanning.
 */

import { execSync } from 'child_process';
import { supabase } from '@/lib/supabaseClient';

/**
 * Get update history (most recent first)
 */
export async function getUpdateHistory(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('update_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error) {
    console.error('[updateRepo] getUpdateHistory error:', error);
    return { success: false, error: error.message, data: [] };
  }
}

/**
 * Create a new update log entry (at start of update)
 */
export async function createUpdateLog(fromVersion, toVersion, triggeredBy) {
  try {
    const { data, error } = await supabase
      .from('update_log')
      .insert({
        from_version: fromVersion,
        to_version: toVersion,
        triggered_by: triggeredBy,
        status: 'in_progress',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[updateRepo] createUpdateLog error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Complete an update log entry (success or failure)
 */
export async function completeUpdateLog(id, { status, migrationsApplied, commitsPulled, errorMessage, logOutput }) {
  try {
    const { data, error } = await supabase
      .from('update_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        migrations_applied: migrationsApplied || 0,
        commits_pulled: commitsPulled || 0,
        error_message: errorMessage || null,
        log_output: logOutput || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('[updateRepo] completeUpdateLog error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending migrations by scanning the migrations/ folder
 * and comparing against schema_migrations table.
 */
export async function getPendingMigrations() {
  try {
    // Run as subprocess to avoid webpack bundling issues with pg module
    const output = execSync(
      'node scripts/run-migrations.js --pending --json',
      { cwd: process.cwd(), encoding: 'utf-8', timeout: 30000, env: { ...process.env } }
    ).trim();
    const result = JSON.parse(output);
    if (result.error) throw new Error(result.error);
    return { success: true, data: result };
  } catch (error) {
    console.error('[updateRepo] getPendingMigrations error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the latest in-progress update (if any)
 */
export async function getActiveUpdate() {
  try {
    const { data, error } = await supabase
      .from('update_log')
      .select('*')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return { success: true, data: data || null };
  } catch (error) {
    console.error('[updateRepo] getActiveUpdate error:', error);
    return { success: false, error: error.message };
  }
}

export const updateRepo = {
  getUpdateHistory,
  createUpdateLog,
  completeUpdateLog,
  getPendingMigrations,
  getActiveUpdate,
};

export default updateRepo;
