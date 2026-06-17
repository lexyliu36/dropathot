import cron from 'node-cron'
import { Resend } from 'resend'
import { supabase } from '../lib/supabase.js'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM || 'dropathot <noreply@dropathot.com>'
const SITE_URL = process.env.SITE_URL || 'https://dropathot.com'
const IS_DEV = process.env.NODE_ENV === 'development'
const DEV_EMAIL = 'dev.lexliu@gmail.com'

function dmDigestHtml(recipientPenName, senderGroups) {
  // senderGroups: [{ senderPenName, messages: [{ content, created_at }] }]
  const senderSections = senderGroups.map(({ senderPenName, messages }) => {
    const preview = messages.length === 1
      ? `<p style="margin:8px 0 0;font-size:14px;color:#cbd5e1;line-height:1.6;font-style:italic">"${messages[0].content}"</p>`
      : messages.map(m =>
          `<p style="margin:6px 0 0;font-size:14px;color:#cbd5e1;line-height:1.6;font-style:italic">"${m.content}"</p>`
        ).join('')

    return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #1e1e2e">
          <p style="margin:0;font-size:15px;font-weight:700;color:#a78bfa">
            ${senderPenName}
            <span style="font-weight:400;color:#64748b;font-size:13px">
              · ${messages.length === 1 ? '1 message' : `${messages.length} messages`}
            </span>
          </p>
          ${preview}
        </td>
      </tr>`
  }).join('')

  const totalMessages = senderGroups.reduce((sum, g) => sum + g.messages.length, 0)
  const totalSenders = senderGroups.length
  const headline = totalSenders === 1
    ? `${senderGroups[0].senderPenName} sent you ${totalMessages === 1 ? 'a message' : `${totalMessages} messages`}`
    : `${totalSenders} people messaged you`

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#0e0e1a;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.07)">
        <tr><td style="height:3px;background:linear-gradient(90deg,#7c3aed,#e11d48)"></td></tr>
        <tr><td style="padding:36px 36px 28px">
          <h1 style="margin:0 0 4px;font-size:26px;font-weight:900;letter-spacing:-0.5px;color:#f1f5f9">dropathot</h1>
          <p style="margin:0 0 24px;font-size:13px;color:#475569">Hey ${recipientPenName} —</p>

          <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#f1f5f9">${headline}</p>

          <table width="100%" cellpadding="0" cellspacing="0">${senderSections}</table>

          <div style="margin-top:28px;text-align:center">
            <a href="${SITE_URL}/map"
               style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px">
              Reply →
            </a>
          </div>

          <hr style="margin:32px 0 16px;border:none;border-top:1px solid rgba(255,255,255,0.06)">
          <p style="margin:0;font-size:11px;color:#475569;line-height:1.6;text-align:center">
            You're receiving this because someone DMed you on dropathot.<br>
            Open the app to reply — you won't get another email until you check your messages.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function runDMDigest() {
  // 1. Fetch all unread, un-emailed messages with sender pen_name
  const { data: pending, error } = await supabase
    .from('messages')
    .select(`
      id,
      to_user_id,
      from_user_id,
      content,
      created_at,
      sender:from_user_id ( pen_name )
    `)
    .is('read_at', null)
    .is('emailed_at', null)
    .order('created_at', { ascending: true })

  if (error) { console.error('[dm-digest] fetch error:', error.message); return }
  if (!pending?.length) return

  // 2. Group by recipient, then by sender within each recipient
  const byRecipient = new Map()
  for (const msg of pending) {
    if (!byRecipient.has(msg.to_user_id)) byRecipient.set(msg.to_user_id, new Map())
    const bySender = byRecipient.get(msg.to_user_id)
    const senderPenName = msg.sender?.pen_name ?? 'Someone'
    if (!bySender.has(msg.from_user_id)) bySender.set(msg.from_user_id, { senderPenName, messages: [] })
    bySender.get(msg.from_user_id).messages.push({ content: msg.content, created_at: msg.created_at })
  }

  // 3. Fetch recipient emails from auth.users (service role)
  const recipientIds = [...byRecipient.keys()]
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authData?.users ?? []).map(u => [u.id, u.email]))

  // 4. Fetch recipient pen_names + prefs
  const { data: recipientUsers } = await supabase
    .from('users')
    .select('id, pen_name, email_dm_digest')
    .in('id', recipientIds)
  const penNameMap = new Map((recipientUsers ?? []).map(u => [u.id, u.pen_name]))
  const dmDigestOptOut = new Set((recipientUsers ?? []).filter(u => u.email_dm_digest === false).map(u => u.id))

  // 5. Send one email per recipient
  const emailedIds = []
  for (const [recipientId, bySender] of byRecipient) {
    const email = emailMap.get(recipientId)
    if (!email) continue
    if (dmDigestOptOut.has(recipientId)) continue // user opted out

    const recipientPenName = penNameMap.get(recipientId) ?? 'there'
    const senderGroups = [...bySender.values()]
    const messageIds = pending
      .filter(m => m.to_user_id === recipientId)
      .map(m => m.id)

    const totalMessages = senderGroups.reduce((sum, g) => sum + g.messages.length, 0)
    const subject = senderGroups.length === 1
      ? `${senderGroups[0].senderPenName} sent you ${totalMessages === 1 ? 'a message' : `${totalMessages} messages`} on dropathot`
      : `${senderGroups.length} people messaged you on dropathot`

    const html = dmDigestHtml(recipientPenName, senderGroups)

    if (!resend) {
      console.log(`[dm-digest:dev] Would email ${email}: ${subject}`)
      senderGroups.forEach(g =>
        g.messages.forEach(m => console.log(`  · ${g.senderPenName}: "${m.content}"`))
      )
      emailedIds.push(...messageIds)
      continue
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: IS_DEV ? DEV_EMAIL : email,
        subject: IS_DEV ? `[DEV] ${subject} (for ${email})` : subject,
        html,
      })
      emailedIds.push(...messageIds)
    } catch (err) {
      console.error(`[dm-digest] failed to send to ${email}:`, err.message)
    }
  }

  // 6. Mark emailed messages so they don't get re-sent
  if (emailedIds.length) {
    const { error: markErr } = await supabase
      .from('messages')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', emailedIds)
    if (markErr) console.error('[dm-digest] mark-emailed error:', markErr.message)
    else console.log(`[dm-digest] emailed ${byRecipient.size} recipient(s), ${emailedIds.length} message(s)`)
  }
}

export function startDigestJob() {
  // Every 15 minutes — only fires if there are unread un-emailed DMs
  cron.schedule('*/15 * * * *', () => {
    console.log('[dm-digest] checking for unread DMs...')
    runDMDigest().catch(err => console.error('[dm-digest] unhandled error:', err))
  })
  console.log('[dm-digest] 15-minute DM digest job scheduled')
}
