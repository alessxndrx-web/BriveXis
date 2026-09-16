import path from 'node:path';
import express, { type Request, type Response } from 'express';
import 'dotenv/config';
import { normalizeInquiry, validateInquiry } from '../src/lib/inquiry';
import { createEmailConfig, renderInquiryEmail } from './email';
import { createRateLimiter } from './rateLimit';

/**
 * Production server: serves the built site and receives project inquiries.
 *
 * The inquiry endpoint lives here rather than in the browser because the email
 * credentials must never reach the client bundle.
 */

// Resolved from the working directory so the same file works both as the
// bundled `server.js` at the project root and under `tsx server/index.ts`.
const distDir = path.resolve(process.cwd(), 'dist');

const app = express();

// Behind a reverse proxy, the client address arrives in X-Forwarded-For. One
// hop only: trusting the whole chain would let a caller forge its own IP and
// walk around the rate limiter.
app.set('trust proxy', 1);
app.disable('x-powered-by');

const emailConfig = createEmailConfig(process.env);

const inquiryLimiter = createRateLimiter({
  limit: Number(process.env.CONTACT_RATE_LIMIT ?? 5),
  windowMs: Number(process.env.CONTACT_RATE_WINDOW_MS ?? 60 * 60 * 1000),
});

/** Response body for every failed submission. Deliberately free of internals. */
function fail(res: Response, status: number, error: string, fields?: Record<string, string>) {
  res.status(status).json(fields ? { error, fields } : { error });
}

app.post(
  '/api/contact',
  express.json({ limit: '32kb' }),
  async (req: Request, res: Response) => {
    const key = req.ip ?? 'unknown';
    if (!inquiryLimiter.check(key)) {
      return fail(res, 429, 'Too many inquiries from this connection. Please try again later.');
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return fail(res, 400, 'The submission could not be read. Please try again.');
    }

    const inquiry = normalizeInquiry(req.body as Record<string, unknown>);

    // Honeypot: a real visitor never sees this field, so any value is a bot.
    // Answering 200 keeps the bot from learning that it was filtered.
    if (inquiry.website) {
      return res.status(200).json({ ok: true });
    }

    const errors = validateInquiry(inquiry);
    if (Object.keys(errors).length > 0) {
      return fail(res, 422, 'Some fields need attention.', errors as Record<string, string>);
    }

    if (!emailConfig) {
      console.error(
        '[contact] Inquiry rejected: email delivery is not configured. Set RESEND_API_KEY, CONTACT_RECIPIENT_EMAIL and CONTACT_FROM_EMAIL.',
      );
      return fail(
        res,
        503,
        'Our inquiry inbox is temporarily unavailable. Please try again later.',
      );
    }

    try {
      await emailConfig.provider.send(renderInquiryEmail(inquiry, emailConfig));
      return res.status(200).json({ ok: true });
    } catch (error) {
      // Full detail stays server-side; the visitor gets a safe message.
      console.error('[contact] Delivery failed:', error);
      return fail(res, 502, 'We could not send your details right now. Please try again.');
    }
  },
);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', contactEmail: emailConfig ? 'configured' : 'unconfigured' });
});

// Hashed build assets are immutable; index.html must always be revalidated so
// a deploy is picked up on the next request.
app.use(
  express.static(distDir, {
    index: false,
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

// Client-side routing: every non-API path is served by the app shell.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`BriveXis server listening on port ${port}`);
  if (!emailConfig) {
    console.warn(
      '[contact] Email delivery is not configured — inquiries will be rejected with a 503.',
    );
  }
});
