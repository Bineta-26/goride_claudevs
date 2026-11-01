/*
 * Email sending through Resend (https://resend.com).
 * Configure in Vercel → Settings → Environment Variables (never in this public repo):
 *   RESEND_API_KEY – your Resend API key (starts with "re_")
 *   EMAIL_FROM     – optional sender, e.g. "GoRide <no-reply@yourdomain.com>".
 *                    Defaults to Resend's test sender, which can only deliver to your own Resend sign-up email
 *                    until you verify a domain in Resend.
 *   APP_URL        – optional public site address used in links, e.g. https://gorideclaudevs.vercel.app
 */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("RESEND_API_KEY is not set; email not sent:", subject); return false; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "GoRide <onboarding@resend.dev>", to: [to], subject, html, text }),
    });
    if (!res.ok) { console.error("Resend error", res.status, await res.text()); return false; }
    return true;
  } catch (error) {
    console.error("Resend request failed", error);
    return false;
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function resetEmail(name: string, link: string) {
  const first = escape(name.split(" ")[0] || "there");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f8f6;font-family:Arial,Helvetica,sans-serif;color:#202b27">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e9eeeb;border-radius:14px">
<tr><td style="padding:28px 28px 8px"><div style="font-size:22px;font-weight:800;color:#10865e">GoRide</div></td></tr>
<tr><td style="padding:8px 28px 0;font-size:15px;line-height:1.6">
<p style="margin:0 0 12px">Hello ${first},</p>
<p style="margin:0 0 18px">We received a request to reset the password for your GoRide account. Select the button below to choose a new password. This link expires in 1 hour and can be used once.</p>
<p style="margin:0 0 22px"><a href="${escape(link)}" style="display:inline-block;background:#10865e;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:9px">Reset my password</a></p>
<p style="margin:0 0 12px;font-size:13px;color:#6b7570">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escape(link)}</span></p>
<p style="margin:0 0 24px;font-size:13px;color:#6b7570">If you did not ask for this, you can ignore this email. Your password will not change.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `Hello ${name.split(" ")[0] || "there"},\n\nWe received a request to reset the password for your GoRide account.\nChoose a new password here (valid for 1 hour, single use):\n${link}\n\nIf you did not ask for this, you can ignore this email.\n\nGoRide`;
  return { subject: "Reset your GoRide password", html, text };
}
