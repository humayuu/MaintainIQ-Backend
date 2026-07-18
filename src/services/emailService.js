import nodemailer from 'nodemailer';

/**
 * Email delivery via SMTP (Nodemailer).
 *
 * DESIGN: this module NEVER throws in a way that blocks the caller. If SMTP
 * isn't configured (no SMTP_HOST/SMTP_USER), it logs the message instead of
 * sending — so local dev and un-configured deploys still work, and issue/user
 * flows are never blocked by a mail failure.
 *
 * Configure via env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const isConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

let cachedTransporter = null;
const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    // 465 = implicit TLS; everything else uses STARTTLS.
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cachedTransporter;
};

/**
 * Send an email. Returns { sent: boolean }. On any failure (or when SMTP isn't
 * configured) it logs and resolves `{ sent: false }` rather than throwing.
 */
export const sendMail = async ({ to, subject, html, text }) => {
  if (!isConfigured()) {
    console.warn(
      `[email] SMTP not configured — skipping send to ${to}. Subject: "${subject}"`,
    );
    return { sent: false };
  }

  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    await getTransporter().sendMail({ from, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error('[email] send failed:', err?.message || 'unknown error');
    return { sent: false };
  }
};

/**
 * Build + send the account verification email. `link` is the full frontend URL
 * the user clicks to verify. Falls back to logging the link when SMTP is off,
 * so a developer can still complete the flow locally.
 */
export const sendVerificationEmail = async (to, link) => {
  if (!isConfigured()) {
    console.warn(`[email] Verification link for ${to}: ${link}`);
  }

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#1565C0;margin-bottom:4px">Verify your email</h2>
      <p style="color:#334155">Welcome to MaintainIQ! Please confirm your email address to finish setting up your account.</p>
      <p style="margin:24px 0">
        <a href="${link}"
           style="background:#1565C0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">
          Verify email
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>${link}</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    </div>`;

  const text = `Verify your MaintainIQ email: ${link} (expires in 24 hours)`;

  return sendMail({ to, subject: 'Verify your MaintainIQ email', html, text });
};

export default { sendMail, sendVerificationEmail };
