/**
 * Project inquiry contract.
 *
 * Deliberately free of browser and Node APIs: the Express handler imports this
 * file too, so the client and the server validate against exactly one set of
 * rules. Client-side validation is a convenience; the server repeats it because
 * a request can arrive without ever touching the form.
 */

export const INDUSTRY_OPTIONS = [
  'Contractors & Field Services',
  'Dealers & Automotive Businesses',
  'Distribution & Wholesale',
  'Other operations-heavy business',
] as const;

export const GOAL_OPTIONS = [
  'Centralizing customer information',
  'Sales and lead management',
  'Inventory and order management',
  'Operational workflows and scheduling',
  'Reporting and visibility',
  'Automating administrative work',
  'Replacing a disconnected set of tools',
] as const;

export const CONTACT_METHOD_OPTIONS = ['Email', 'Phone call', 'Video call'] as const;

export interface ProjectInquiry {
  name: string;
  company: string;
  email: string;
  phone: string;
  industry: string;
  goal: string;
  description: string;
  preferredContact: string;
  /**
   * Honeypot. Hidden from real users, so any value at all means a bot filled in
   * every field it found.
   */
  website?: string;
}

export const emptyInquiry: ProjectInquiry = {
  name: '',
  company: '',
  email: '',
  phone: '',
  industry: '',
  goal: '',
  description: '',
  preferredContact: '',
  website: '',
};

/** Maximum accepted length per field. Enforced on both sides. */
export const FIELD_LIMITS = {
  name: 80,
  company: 120,
  email: 160,
  phone: 40,
  industry: 120,
  goal: 160,
  description: 4000,
  preferredContact: 40,
} as const;

export const DESCRIPTION_MIN = 20;

/** Intentionally permissive: the authoritative check is whether the reply lands. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InquiryErrors = Partial<Record<keyof ProjectInquiry, string>>;

/** Collapses whitespace and trims every field, then clips to the field limit. */
export function normalizeInquiry(input: Partial<Record<keyof ProjectInquiry, unknown>>): ProjectInquiry {
  const clean = (value: unknown, limit: number) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';

  return {
    name: clean(input.name, FIELD_LIMITS.name),
    company: clean(input.company, FIELD_LIMITS.company),
    email: clean(input.email, FIELD_LIMITS.email).toLowerCase(),
    phone: clean(input.phone, FIELD_LIMITS.phone),
    industry: clean(input.industry, FIELD_LIMITS.industry),
    goal: clean(input.goal, FIELD_LIMITS.goal),
    // Paragraph breaks carry meaning here, so only trailing space is collapsed.
    description:
      typeof input.description === 'string'
        ? input.description.replace(/[ \t]+/g, ' ').trim().slice(0, FIELD_LIMITS.description)
        : '',
    preferredContact: clean(input.preferredContact, FIELD_LIMITS.preferredContact),
    website: clean(input.website, 200),
  };
}

export function validateInquiry(inquiry: ProjectInquiry): InquiryErrors {
  const errors: InquiryErrors = {};

  if (!inquiry.name.trim()) errors.name = 'Please enter your name.';
  if (!inquiry.company.trim()) errors.company = 'Please enter your company.';

  if (!inquiry.email.trim()) {
    errors.email = 'Please enter your work email.';
  } else if (!EMAIL_PATTERN.test(inquiry.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!inquiry.industry) {
    errors.industry = 'Please select an industry.';
  } else if (!INDUSTRY_OPTIONS.includes(inquiry.industry as (typeof INDUSTRY_OPTIONS)[number])) {
    errors.industry = 'Please select one of the listed industries.';
  }

  if (!inquiry.goal) {
    errors.goal = 'Please select what you would like to improve.';
  } else if (!GOAL_OPTIONS.includes(inquiry.goal as (typeof GOAL_OPTIONS)[number])) {
    errors.goal = 'Please select one of the listed options.';
  }

  if (inquiry.description.trim().length < DESCRIPTION_MIN) {
    errors.description = 'Please describe the project in at least a couple of sentences.';
  }

  if (
    inquiry.preferredContact &&
    !CONTACT_METHOD_OPTIONS.includes(
      inquiry.preferredContact as (typeof CONTACT_METHOD_OPTIONS)[number],
    )
  ) {
    errors.preferredContact = 'Please select one of the listed contact methods.';
  }

  // A phone call cannot be returned without a number to call.
  if (inquiry.preferredContact === 'Phone call' && !inquiry.phone.trim()) {
    errors.phone = 'Please add a phone number so we can call you.';
  }

  return errors;
}
