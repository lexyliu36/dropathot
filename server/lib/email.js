import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM || 'dropathot <noreply@dropathot.com>'

function verifyTemplate(actionLink) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <!-- header bar -->
        <tr><td style="height:4px;background:linear-gradient(90deg,#7c3aed,#e11d48)"></td></tr>
        <!-- body -->
        <tr><td style="padding:40px 40px 32px">
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0a0a0f">dropathot</h1>
          <p style="margin:0 0 32px;font-size:13px;color:#94a3b8">Verify your email to continue</p>

          <p style="margin:0 0 8px;font-size:15px;color:#1e293b;line-height:1.6">
            You're almost in. Click the button below to verify your email address and activate your account.
          </p>
          <p style="margin:0 0 32px;font-size:13px;color:#64748b;line-height:1.6">
            This link expires in 24 hours.
          </p>

          <a href="${actionLink}"
             style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px">
            Verify my email →
          </a>

          <hr style="margin:40px 0 24px;border:none;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6">
            If you didn't create an account on dropathot, you can safely ignore this email.
            Your address was not added to any mailing list.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const DEV_EMAIL = 'dev.lexliu@gmail.com'
const IS_DEV = process.env.NODE_ENV === 'development'

export async function sendVerificationEmail(to, actionLink) {
  if (!resend) {
    // No API key — log the link so dev can click it manually
    console.log(`\n[EMAIL] Verification link for ${to}:\n${actionLink}\n`)
    return
  }

  const recipient = IS_DEV ? DEV_EMAIL : to
  if (IS_DEV) console.log(`[EMAIL:dev] Redirecting email for ${to} → ${DEV_EMAIL}`)

  const { error } = await resend.emails.send({
    from: FROM,
    to: recipient,
    subject: IS_DEV
      ? `[DEV] Verify dropathot account (for ${to})`
      : 'Verify your dropathot account',
    html: verifyTemplate(actionLink),
  })
  if (error) throw new Error(`Failed to send email: ${error.message}`)
}


// ---------------------------------------------------------------------------
// Support alert emails — sent to the ops address for every important detection.
// Uses a per-type cooldown so a sustained attack doesn't flood the inbox.
// ---------------------------------------------------------------------------
const SUPPORT_EMAIL = 'dev.lexliu@gmail.com'
const alertCooldowns = new Map() // `${type}:${key}` → last sent timestamp

/**
 * Send an alert email to the support address.
 *
 * @param {object} opts
 * @param {string} opts.type      - short identifier, e.g. 'subnet-limit', 'velocity-spike'
 * @param {string} opts.subject   - email subject line
 * @param {string} opts.key       - dedup key (e.g. subnet hash, h3 tile) — cooldown is per type+key
 * @param {number} opts.cooldownMs - how long to suppress repeat alerts for same key (default 30 min)
 * @param {Record<string,string>} opts.fields - key/value pairs shown in the email body
 */
export async function alertSupport({ type, subject, key, cooldownMs = 30 * 60 * 1000, fields = {} }) {
  const cooldownKey = `${type}:${key}`
  const lastSent = alertCooldowns.get(cooldownKey) ?? 0
  if (Date.now() - lastSent < cooldownMs) return  // suppress repeat within window

  alertCooldowns.set(cooldownKey, Date.now())

  const rows = Object.entries(fields)
    .map(([k, v]) => `
        <tr>
          <td style="padding:6px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top">${k}</td>
          <td style="padding:6px 0;font-size:13px;color:#1e293b;font-family:monospace;word-break:break-all">${v}</td>
        </tr>`)
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">
        <tr><td style="height:4px;background:linear-gradient(90deg,#e11d48,#7c3aed)"></td></tr>
        <tr><td style="padding:32px 36px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#e11d48;text-transform:uppercase">${type}</p>
          <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#0a0a0f">${subject}</h2>
          <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          <hr style="margin:24px 0;border:none;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:12px;color:#94a3b8">dropathot automated alert · ${new Date().toUTCString()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!resend) {
    console.log(`[ALERT:${type}] ${subject}`, fields)
    return
  }

  try {
    await resend.emails.send({
      from: FROM,
      to: SUPPORT_EMAIL,
      subject: `[dropathot Alert] ${subject}`,
      html,
    })
  } catch (err) {
    console.error(`[alertSupport] failed to send: ${err.message}`)
  }
}


// ---------------------------------------------------------------------------
// Admin moderation review emails
// ---------------------------------------------------------------------------

const APP_URL = process.env.SITE_URL || process.env.APP_URL || 'http://localhost:5173'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''

function modCardStyle() {
  return `background:#0e0e1a;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 20px;margin:0 0 20px`
}

function actionButton(label, url, color = '#7c3aed') {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:11px 24px;border-radius:10px;font-weight:700;font-size:14px;margin-right:10px">${label}</a>`
}

function darkWrapper(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0e0e1a;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.07)">
        <tr><td style="height:4px;background:linear-gradient(90deg,#e11d48,#7c3aed)"></td></tr>
        <tr><td style="padding:32px 36px">${body}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/** Email to admin when a thot hits 3 reports */
export async function sendThotReviewEmail(thot, reportCount) {
  const reviewUrl = `${APP_URL}/drop-ops?review=thot&id=${thot.id}`
  const body = `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#e11d48;text-transform:uppercase">Moderation · Thot Flagged</p>
    <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#ffffff">${reportCount} reports — review required</h2>
    <div style="${modCardStyle()}">
      <p style="margin:0 0 8px;font-size:15px;color:#e2e8f0;line-height:1.6">"${thot.content}"</p>
      <p style="margin:0;font-size:12px;color:#64748b">${thot.pen_name || 'anon'} · ${new Date(thot.created_at).toUTCString()}</p>
    </div>
    <p style="margin:0 0 20px">${actionButton('Review thot →', reviewUrl, '#e11d48')}</p>
    <p style="margin:0;font-size:12px;color:#475569">Thot ID: <code style="color:#94a3b8">${thot.id}</code></p>`

  if (!resend) { console.log(`[MOD EMAIL] Thot flagged: ${reviewUrl}`); return }
  await resend.emails.send({
    from: FROM, to: SUPPORT_EMAIL,
    subject: `[dropathot] Thot flagged — ${reportCount} reports`,
    html: darkWrapper(body),
  }).catch(err => console.error('[sendThotReviewEmail]', err.message))
}

/** Email to admin when a user hits 3 reports */
export async function sendUserReviewEmail(user, reportCount) {
  const reviewUrl = `${APP_URL}/drop-ops?review=user&id=${user.id}`
  const body = `
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#e11d48;text-transform:uppercase">Moderation · User Reported</p>
    <h2 style="margin:0 0 24px;font-size:20px;font-weight:800;color:#ffffff">${reportCount} reports against ${user.pen_name}</h2>
    <div style="${modCardStyle()}">
      <p style="margin:0 0 4px;font-size:15px;color:#e2e8f0;font-weight:700">${user.pen_name}</p>
      <p style="margin:0;font-size:12px;color:#64748b">Joined ${new Date(user.created_at).toUTCString()}</p>
    </div>
    <p style="margin:0 0 20px">${actionButton('Review user →', reviewUrl, '#e11d48')}</p>
    <p style="margin:0;font-size:12px;color:#475569">User ID: <code style="color:#94a3b8">${user.id}</code></p>`

  if (!resend) { console.log(`[MOD EMAIL] User flagged: ${reviewUrl}`); return }
  await resend.emails.send({
    from: FROM, to: SUPPORT_EMAIL,
    subject: `[dropathot] User reported — ${user.pen_name} (${reportCount} reports)`,
    html: darkWrapper(body),
  }).catch(err => console.error('[sendUserReviewEmail]', err.message))
}

/** Email to user when their thot is unhidden after review */
export async function sendThotRestoredEmail(toEmail, penName, thotContent) {
  const body = `
    <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff">dropathot</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Account update</p>
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6">
      Hi <strong>${penName}</strong>, your thot was reported by other users. After review, we've determined it doesn't violate our community guidelines — it's been restored to the map.
    </p>
    <div style="${modCardStyle()}">
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.6">"${thotContent}"</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">No action is needed on your part. Thanks for being part of the community.</p>`

  if (!resend) { console.log(`[MOD EMAIL] Thot restored for ${toEmail}`); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: 'Your thot has been restored — dropathot',
    html: darkWrapper(body),
  }).catch(err => console.error('[sendThotRestoredEmail]', err.message))
}

/** Email to user when their thot is permanently removed after review */
export async function sendThotRemovedEmail(toEmail, penName, thotContent, reason) {
  const body = `
    <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff">dropathot</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Content removal notice</p>
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6">
      Hi <strong>${penName}</strong>, after reviewing reports on your thot, we've determined it violates our <a href="${APP_URL}/legal/terms" style="color:#7c3aed">community guidelines</a> and it has been permanently removed.
    </p>
    <div style="${modCardStyle()}">
      <p style="margin:0 0 8px;font-size:14px;color:#e2e8f0;line-height:1.6">"${thotContent}"</p>
      ${reason ? `<p style="margin:0;font-size:12px;color:#64748b">Reason: ${reason}</p>` : ''}
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">Repeated violations may result in account suspension. If you believe this is an error, reply to this email.</p>`

  if (!resend) { console.log(`[MOD EMAIL] Thot removed for ${toEmail}`); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: 'Content removal notice — dropathot',
    html: darkWrapper(body),
  }).catch(err => console.error('[sendThotRemovedEmail]', err.message))
}

/** Email to user when they are banned */
export async function sendUserBannedEmail(toEmail, penName, reason) {
  const body = `
    <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff">dropathot</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Account notice</p>
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6">
      Hi <strong>${penName}</strong>, your account has been suspended for violating our <a href="${APP_URL}/legal/terms" style="color:#7c3aed">community guidelines</a>.
    </p>
    ${reason ? `<div style="${modCardStyle()}"><p style="margin:0;font-size:14px;color:#e2e8f0">Reason: ${reason}</p></div>` : ''}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">Your posts have been removed. If you believe this is an error, reply to this email to appeal.</p>`

  if (!resend) { console.log(`[MOD EMAIL] User banned: ${toEmail}`); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: 'Your account has been suspended — dropathot',
    html: darkWrapper(body),
  }).catch(err => console.error('[sendUserBannedEmail]', err.message))
}

/** Email to user when they are unbanned */
export async function sendUserUnbannedEmail(toEmail, penName) {
  const body = `
    <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff">dropathot</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Account update</p>
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6">
      Hi <strong>${penName}</strong>, your account suspension has been lifted. You can now log back in and post normally.
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">Thanks for your patience. Please review our <a href="${APP_URL}/legal/terms" style="color:#7c3aed">community guidelines</a> before posting again.</p>`

  if (!resend) { console.log(`[MOD EMAIL] User unbanned: ${toEmail}`); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: 'Your account has been reinstated — dropathot',
    html: darkWrapper(body),
  }).catch(err => console.error('[sendUserUnbannedEmail]', err.message))
}

/** Email to user when reports against them were reviewed and no action was taken */
export async function sendUserReportsDismissedEmail(toEmail, penName) {
  const body = `
    <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;color:#ffffff">dropathot</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#94a3b8">Account update</p>
    <p style="margin:0 0 16px;font-size:15px;color:#e2e8f0;line-height:1.6">
      Hi <strong>${penName}</strong>, we received reports about your activity on dropathot. After review, we found no violations of our <a href="${APP_URL}/legal/terms" style="color:#7c3aed">community guidelines</a>.
    </p>
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6">No action has been taken on your account. You're all good — keep dropping thots.</p>`

  if (!resend) { console.log(`[MOD EMAIL] Reports dismissed for ${toEmail}`); return }
  await resend.emails.send({
    from: FROM, to: toEmail,
    subject: 'Reports reviewed — no action taken — dropathot',
    html: darkWrapper(body),
  }).catch(err => console.error('[sendUserReportsDismissedEmail]', err.message))
}
