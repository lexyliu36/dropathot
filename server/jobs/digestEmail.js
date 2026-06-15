import cron from 'node-cron'
import { Resend } from 'resend'
import { supabase } from '../lib/supabase.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM || 'dropathot <noreply@dropathot.com>'
const SITE_URL = process.env.SITE_URL || 'https://dropathot.com'
const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_EMAIL = 'dev.lexliu@gmail.com'

const TYPE_LABEL = {
  like:    (n) => `<strong>${n.actor_pen_name}</strong> liked your thot`,
  comment: (n) => `<strong>${n.actor_pen_name}</strong> commented on your thot`,
  follow:  (n) => `<strong>${n.actor_pen_name}</strong> followed you`,
}

function digestHtml(penName, notifications) {
  const items = notifications.map(n => {
    const label = TYPE_LABEL[n.type]?.(n) ?? `New ${n.type}`
    const preview = n.thot_preview
      ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;font-style:italic">"${n.thot_preview}${n.thot_preview.length >= 80 ? '…' : ''}"</p>`
      : ''
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9">
          <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.5">${label}</p>
          ${preview}
        </td>
      </tr>`
  }).join('')

  const count = notifications.length
  const headline = count === 1
    ? '1 thing happened while you were away'
    : `${count} things happened while you were away`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <tr><td style="height:4px;background:linear-gradient(90deg,#7c3aed,#e11d48)"></td></tr>
        <tr><td style="padding:40px 40px 32px">
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0a0a0f">dropathot</h1>
          <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Hey ${penName} —</p>

          <p style="margin:0 0 24px;font-size:16px;font-weight:700;color:#0a0a0f">${headline}</p>

          <table width="100%" cellpadding="0" cellspacing="0">${items}</table>

          <div style="margin-top:32px;text-align:center">
            <a href="${SITE_URL}/map"
               style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px">
              See what's happening →
            </a>
          </div>

          <hr style="margin:36px 0 20px;border:none;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;text-align:center">
            You're receiving this because you have a dropathot account.<br>
            We only email you when something actually happens.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function runDigest() {
  // 1. Fetch all pending notifications with their user's email + pen_name
  const { data: pending, error } = await supabase
    .from('notification_queue')
    .select(`
      id,
      user_id,
      type,
      actor_pen_name,
      thot_preview,
      thot_id,
      users!notification_queue_user_id_fkey ( pen_name ),
      auth_users:user_id ( email )
    `)
    .is('emailed_at', null)
    .order('created_at', { ascending: true })

  if (error) { console.error('[digest] fetch error:', error.message); return }
  if (!pending?.length) return

  // 2. Group by user_id
  const byUser = new Map()
  for (const n of pending) {
    if (!byUser.has(n.user_id)) byUser.set(n.user_id, { notifications: [], penName: null, email: null })
    const entry = byUser.get(n.user_id)
    entry.notifications.push(n)
    entry.penName = n.users?.pen_name ?? 'there'
  }

  // 3. Fetch emails from auth.users (service role required)
  const userIds = [...byUser.keys()]
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email]))

  // 4. Send one email per user
  const sentIds = []
  for (const [userId, { notifications, penName }] of byUser) {
    const email = emailMap.get(userId)
    if (!email) continue

    const html = digestHtml(penName, notifications)
    const subject = notifications.length === 1
      ? `${notifications[0].actor_pen_name} interacted with your thot`
      : `${notifications.length} new interactions on dropathot`

    if (!resend) {
      console.log(`[digest:dev] Would email ${email}: ${subject}`)
      console.log(notifications.map(n => `  · ${n.type} from ${n.actor_pen_name}`).join('\n'))
      sentIds.push(...notifications.map(n => n.id))
      continue
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: IS_DEV ? DEV_EMAIL : email,
        subject: IS_DEV ? `[DEV] ${subject} (for ${email})` : subject,
        html,
      })
      sentIds.push(...notifications.map(n => n.id))
    } catch (err) {
      console.error(`[digest] failed to send to ${email}:`, err.message)
    }
  }

  // 5. Mark sent rows
  if (sentIds.length) {
    const { error: markErr } = await supabase
      .from('notification_queue')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', sentIds)
    if (markErr) console.error('[digest] mark-sent error:', markErr.message)
    else console.log(`[digest] sent ${byUser.size} digest email(s) covering ${sentIds.length} notification(s)`)
  }
}

export function startDigestJob() {
  // Run at the top of every hour
  cron.schedule('0 * * * *', () => {
    console.log('[digest] running hourly digest...')
    runDigest().catch(err => console.error('[digest] unhandled error:', err))
  })
  console.log('[digest] hourly digest job scheduled')
}
