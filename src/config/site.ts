/**
 * Public site configuration.
 *
 * Safe, public values only — never secrets. Anything that depends on the
 * deployment (the canonical origin) reads from a build-time variable so the
 * same source works in preview and production.
 */

/** Canonical origin, no trailing slash. Falls back to the production domain. */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://brivexis.com'
).replace(/\/+$/, '');

export const site = {
  name: 'BriveXis',
  tagline: 'Custom business software built around real operations.',
  description:
    'BriveXis designs and builds custom business software — CRM, inventory, operations and reporting systems — around the way your company actually works.',
  location: {
    city: 'Managua',
    country: 'Nicaragua',
    label: 'Managua, Nicaragua',
    /** ISO 3166-1 alpha-2, used by structured data. */
    countryCode: 'NI',
    timezone: 'UTC-6',
  },
  serves: 'Serving businesses across the U.S. and Latin America.',
  languages: ['English', 'Spanish'],
} as const;

/**
 * Business contact details.
 *
 * These are empty until real, verified values exist. Nothing in the UI invents
 * a fallback: an unset value simply is not rendered, and the inquiry form stays
 * the contact mechanism. Set them through the build-time variables in
 * `.env.example` once the accounts are live.
 */
export const contactDetails = {
  email: import.meta.env.VITE_CONTACT_EMAIL ?? '',
  phone: import.meta.env.VITE_CONTACT_PHONE ?? '',
  linkedin: import.meta.env.VITE_LINKEDIN_URL ?? '',
} as const;

export const routes = {
  home: '/',
  privacy: '/privacy',
} as const;

/** Primary navigation. Same list drives the header, the mobile panel and SEO. */
export const primaryNav = [
  { name: 'Solutions', href: '/#solutions' },
  { name: 'Industries', href: '/#industries' },
  { name: 'Demos', href: '/#demos' },
  { name: 'Why BriveXis', href: '/#why-us' },
  { name: 'Process', href: '/#process' },
  { name: 'About', href: '/#about' },
] as const;

export const footerNav = [
  { name: 'Solutions', href: '/#solutions' },
  { name: 'Industries', href: '/#industries' },
  { name: 'Demos', href: '/#demos' },
  { name: 'About', href: '/#about' },
  { name: 'Contact', href: '/#contact' },
] as const;

/** Anchor used by every primary call to action. */
export const CONTACT_ANCHOR = '/#contact';
