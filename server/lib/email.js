import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM || 'drop-a-thot <noreply@dropathot.com>'

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
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0a0a0f">drop-a-thot</h1>
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
            If you didn't create an account on drop-a-thot, you can safely ignore this email.
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
      ? `[DEV] Verify drop-a-thot account (for ${to})`
      : 'Verify your drop-a-thot account',
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
          <p style="margin:0;font-size:12px;color:#94a3b8">drop-a-thot automated alert · ${new Date().toUTCString()}</p>
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
      subject: `[drop-a-thot Alert] ${subject}`,
      html,
    })
  } catch (err) {
    console.error(`[alertSupport] failed to send: ${err.message}`)
  }
}
