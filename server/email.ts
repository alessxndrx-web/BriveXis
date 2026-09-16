import type { ProjectInquiry } from '../src/lib/inquiry';

/**
 * Transactional email delivery.
 *
 * A thin provider interface with a Resend implementation over `fetch`, so no
 * vendor SDK is pulled into the server bundle. To move to another provider,
 * add a second `EmailProvider` and select it in `createEmailProvider`.
 *
 * Every value comes from the environment. Nothing is hardcoded and nothing is
 * logged that would put an API key into a log stream.
 */

export interface EmailMessage {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Thrown when the provider rejects the message. Never shown to the visitor. */
export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

function resendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    async send(message) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new EmailDeliveryError(
          `Resend responded with ${response.status}: ${detail.slice(0, 500)}`,
        );
      }
    },
  };
}

export interface EmailConfig {
  provider: EmailProvider;
  recipient: string;
  sender: string;
}

/**
 * Builds the configured provider, or returns null when the deployment has not
 * been given credentials yet. A null config is not an error at startup — the
 * inquiry endpoint reports that submissions are unavailable rather than
 * accepting a message it cannot deliver.
 */
export function createEmailConfig(env: NodeJS.ProcessEnv): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const recipient = env.CONTACT_RECIPIENT_EMAIL?.trim();
  const sender = env.CONTACT_FROM_EMAIL?.trim();

  if (!apiKey || !recipient || !sender) return null;

  return { provider: resendProvider(apiKey), recipient, sender };
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Inquiry text is attacker-controlled, so it is escaped before it reaches HTML. */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function renderInquiryEmail(inquiry: ProjectInquiry, config: EmailConfig): EmailMessage {
  const rows: [string, string][] = [
    ['Name', inquiry.name],
    ['Company', inquiry.company],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone || '—'],
    ['Industry', inquiry.industry],
    ['Goal', inquiry.goal],
    ['Preferred contact', inquiry.preferredContact || '—'],
  ];

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Project description:',
    inquiry.description,
  ].join('\n');

  const html = [
    '<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;color:#191919;line-height:1.6">',
    `<h2 style="font-size:17px;margin:0 0 16px">New project inquiry — ${escapeHtml(inquiry.company)}</h2>`,
    '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:4px 20px 4px 0;color:#6D6A66">${escapeHtml(label)}</td>` +
        `<td style="padding:4px 0"><strong>${escapeHtml(value)}</strong></td></tr>`,
    ),
    '</table>',
    '<p style="margin:20px 0 6px;color:#6D6A66">Project description</p>',
    `<p style="margin:0;white-space:pre-wrap">${escapeHtml(inquiry.description)}</p>`,
    '</div>',
  ].join('');

  return {
    to: config.recipient,
    from: config.sender,
    // Replying to the notification reaches the prospect directly.
    replyTo: inquiry.email,
    subject: `Project inquiry — ${inquiry.company} (${inquiry.industry})`,
    text,
    html,
  };
}
