/** AssistLens-branded invite email content (plain + HTML for clipboard / compose). */

export interface InviteEmailOptions {
  inviteUrl: string;
  sessionTitle?: string;
  agentName?: string;
}

export interface InviteEmailContent {
  subject: string;
  plainText: string;
  html: string;
}

const BRAND = '#0f766e';
const BRAND_HOVER = '#0d9488';
const HEADER_BG = '#0c0a09';
const ACCENT = '#2dd4bf';
const BODY_BG = '#fafaf9';
const CARD_BG = '#ffffff';
const TEXT = '#1c1917';
const MUTED = '#57534e';
const SUBTLE = '#78716c';

export function buildInviteEmail({
  inviteUrl,
  sessionTitle,
  agentName,
}: InviteEmailOptions): InviteEmailContent {
  const sessionLabel = sessionTitle?.trim() || 'Video support session';
  const subject = `Join your AssistLens video call — ${sessionLabel}`;

  const intro = agentName
    ? `${agentName} invited you to a live video support call.`
    : 'Your support agent invited you to a live video support call.';

  const plainText = [
    'AssistLens — Visual customer support',
    '',
    intro,
    '',
    `Session: ${sessionLabel}`,
    '',
    'Join the call (works in any browser, no app install):',
    inviteUrl,
    '',
    'This link expires when the session ends.',
    '',
    '— AssistLens',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BODY_BG};font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BODY_BG};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:${CARD_BG};border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;box-shadow:0 4px 24px -4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:${HEADER_BG};padding:28px 32px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <div style="width:36px;height:36px;background-color:${BRAND};border-radius:8px;text-align:center;line-height:36px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;">◉</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:17px;font-weight:700;color:#f5f5f4;letter-spacing:-0.02em;">Assist<span style="color:${ACCENT};">Lens</span></span>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#a8a29e;">Visual customer support</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;line-height:1.25;color:${TEXT};letter-spacing:-0.02em;">
                You're invited to a video call
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">
                ${escapeHtml(intro)}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 28px;width:100%;">
                <tr>
                  <td style="padding:14px 16px;background-color:#f5f5f4;border-radius:8px;border-left:3px solid ${BRAND};">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${SUBTLE};">Session</p>
                    <p style="margin:0;font-size:15px;font-weight:600;color:${TEXT};">${escapeHtml(sessionLabel)}</p>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${BRAND};">
                    <a href="${escapeHtml(inviteUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                      Join video call →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${SUBTLE};text-align:center;">
                No app install needed — works in Chrome, Safari, and mobile browsers.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${SUBTLE};text-align:center;">
                Or copy this link: <a href="${escapeHtml(inviteUrl)}" style="color:${BRAND_HOVER};word-break:break-all;">${escapeHtml(inviteUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f5f5f4;border-top:1px solid #e7e5e4;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:${SUBTLE};text-align:center;">
                This invite link expires when the session ends.<br />
                AssistLens · Self-hosted visual support
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, plainText, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function gmailComposeUrl(subject: string, body?: string): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', su: subject });
  if (body) params.set('body', body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export async function copyInviteEmail(content: InviteEmailContent): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([content.html], { type: 'text/html' }),
          'text/plain': new Blob([content.plainText], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
    await navigator.clipboard.writeText(content.plainText);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(content.plainText);
      return true;
    } catch {
      return false;
    }
  }
}
