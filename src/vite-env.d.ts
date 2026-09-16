/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical origin used by canonical links, Open Graph URLs and JSON-LD. */
  readonly VITE_SITE_URL?: string;
  /** Overrides the inquiry endpoint. Unset means same-origin `/api/contact`. */
  readonly VITE_CONTACT_ENDPOINT?: string;
  /** Public contact channels. Rendered only once a real value is supplied. */
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_CONTACT_PHONE?: string;
  readonly VITE_LINKEDIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
