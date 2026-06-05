import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM = process.env.EMAIL_FROM || 'Thots. <noreply@thots.app>'

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
          <h1 style="margin:0 0 4px;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#0a0a0f">Thots.</h1>
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
            If you didn't create an account on Thots., you can safely ignore this email.
            Your address was not added to any mailing list.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const DEV_OVERRIDE_EMAIL = 'dev.lexliu@gmail.com'
const IS_PROD = process.env.NODE_ENV === 'production'

export async function sendVerificationEmail(to, actionLink) {
  if (!resend) {
    console.log(`\n[EMAIL] Verification link for ${to}:\n${actionLink}\n`)
    return
  }

  const recipient = IS_PROD ? to : DEV_OVERRIDE_EMAIL
  if (!IS_PROD) {
    console.log(`[EMAIL:dev] Redirecting email for ${to} → ${DEV_OVERRIDE_EMAIL}`)
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to: recipient,
    subject: IS_PROD
      ? 'Verify your Thots. account'
      : `[DEV] Verify Thots. account (originally for ${to})`,
    html: verifyTemplate(actionLink),
  })
  if (error) throw new Error(`Failed to send email: ${error.message}`)
}
