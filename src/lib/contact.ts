import type { ProjectInquiry } from './inquiry';

/**
 * Browser-side submission of the project inquiry.
 *
 * Posts to the Express handler in `server/`. `VITE_CONTACT_ENDPOINT` overrides
 * the path for deployments where the API lives on another origin; it is left
 * unset for the default same-origin setup.
 */

const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT || '/api/contact';

export class InquiryError extends Error {
  /** true when the message is safe and useful to show the visitor as-is. */
  readonly userFacing: boolean;

  constructor(message: string, userFacing = true) {
    super(message);
    this.name = 'InquiryError';
    this.userFacing = userFacing;
  }
}

export async function submitProjectInquiry(inquiry: ProjectInquiry): Promise<void> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiry),
    });
  } catch {
    throw new InquiryError(
      'We could not reach our server. Please check your connection and try again.',
    );
  }

  if (response.ok) return;

  if (response.status === 429) {
    throw new InquiryError(
      'Several inquiries have already been sent from this connection. Please try again shortly.',
    );
  }

  // The server returns a safe message for expected failures; anything else
  // falls back to a generic one so no internal detail reaches the page.
  const message = await response
    .json()
    .then((body: { error?: unknown }) => (typeof body.error === 'string' ? body.error : null))
    .catch(() => null);

  throw new InquiryError(
    message ?? 'Something went wrong while sending your details. Please try again.',
  );
}
