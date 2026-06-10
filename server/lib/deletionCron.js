/**
 * deletionCron.js
 *
 * Runs daily at 02:00 UTC. Hard-deletes any user account where
 * deletion_requested_at is older than 30 days:
 *
 *   1. Anonymise their thots (pen_name → null)
 *   2. Anonymise their comments (pen_name → null)
 *   3. Delete their hype records
 *   4. Delete from public.users
 *   5. Delete from auth.users (releases the email for re-use)
 */

import cron from 'node-cron'
import { supabase } from './supabase.js'
import { alertSupport } from './email.js'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

async function hardDeleteExpiredAccounts() {
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()

  // Find all users past their 30-day window
  const { data: users, error } = await supabase
    .from('users')
    .select('id, deletion_requested_at')
    .not('deletion_requested_at', 'is', null)
    .lte('deletion_requested_at', cutoff)

  if (error) {
    console.error('[deletion-cron] Failed to query pending deletions:', error.message)
    return
  }
  if (!users?.length) return

  console.log(`[deletion-cron] Hard-deleting ${users.length} account(s)`)

  for (const user of users) {
    try {
      // 1. Anonymise thots
      await supabase
        .from('thots')
        .update({ pen_name: null })
        .eq('session_id', user.id)   // session_id is the user's UUID for auth users

      // 2. Anonymise comments
      await supabase
        .from('comments')
        .update({ pen_name: null })
        .eq('user_id', user.id)

      // 3. Delete hypes
      await supabase
        .from('hypes')
        .delete()
        .eq('user_id', user.id)

      // 4. Delete public.users row
      await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      // 5. Delete auth.users — releases the email for re-use
      const { error: authErr } = await supabase.auth.admin.deleteUser(user.id)
      if (authErr) throw new Error(`auth.users delete failed: ${authErr.message}`)

      console.log(`[deletion-cron] Deleted user ${user.id}`)
    } catch (err) {
      console.error(`[deletion-cron] Failed to delete user ${user.id}:`, err.message)
      await alertSupport({
        type: 'deletion-cron-error',
        subject: `Hard delete failed for user ${user.id}`,
        key: user.id,
        cooldownMs: 0,
        fields: {
          'User ID': user.id,
          'Requested at': user.deletion_requested_at,
          'Error': err.message,
        },
      }).catch(() => {})
    }
  }

  if (users.length > 0) {
    await alertSupport({
      type: 'deletion-cron',
      subject: `Hard-deleted ${users.length} account(s)`,
      key: 'daily-run',
      cooldownMs: 0,
      fields: {
        'Count': String(users.length),
        'User IDs': users.map(u => u.id).join(', '),
      },
    }).catch(() => {})
  }
}

export function startDeletionCron() {
  // Run every day at 02:00 UTC
  cron.schedule('0 2 * * *', () => {
    console.log('[deletion-cron] Running hard-delete sweep…')
    hardDeleteExpiredAccounts().catch(err =>
      console.error('[deletion-cron] Unhandled error:', err.message)
    )
  }, { timezone: 'UTC' })

  console.log('[deletion-cron] Scheduled — daily at 02:00 UTC')
}
