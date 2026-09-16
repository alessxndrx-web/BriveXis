import { useEffect } from 'react';
import { SITE_URL, contactDetails, site } from '../config/site';

/**
 * Per-route document metadata.
 *
 * The site renders on the client, so `index.html` carries the defaults that
 * crawlers and link unfurlers read first, and these hooks keep the live
 * document correct as the visitor moves between routes.
 */

interface PageMeta {
  title: string;
  description: string;
  /** Absolute path of this route, e.g. '/privacy'. */
  path: string;
  /** Keep the page out of search results (used for routes with no public value). */
  noindex?: boolean;
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export function useDocumentMeta({ title, description, path, noindex }: PageMeta) {
  useEffect(() => {
    const canonical = `${SITE_URL}${path === '/' ? '/' : path}`;

    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    );
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [title, description, path, noindex]);
}

/** Injects a JSON-LD block for the lifetime of the component. */
export function useStructuredData(id: string, data: object | null) {
  useEffect(() => {
    if (!data) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [id, data]);
}

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * Organization schema.
 *
 * Only verified facts are emitted. Contact channels and social profiles appear
 * only once they are configured, so the markup never asserts a phone number or
 * profile that does not exist.
 */
export function organizationSchema() {
  const profiles = [contactDetails.linkedin].filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: site.name,
    url: `${SITE_URL}/`,
    description: site.description,
    logo: `${SITE_URL}/favicon.svg`,
    image: `${SITE_URL}/og-image.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.location.city,
      addressCountry: site.location.countryCode,
    },
    knowsLanguage: ['en', 'es'],
    ...(contactDetails.email ? { email: contactDetails.email } : {}),
    ...(contactDetails.phone ? { telephone: contactDetails.phone } : {}),
    ...(profiles.length > 0 ? { sameAs: profiles } : {}),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: site.name,
    description: site.description,
    inLanguage: 'en-US',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

/**
 * ProfessionalService schema for the services BriveXis actually offers.
 * No ratings, no price range, no opening hours — none of those are verified.
 */
export function professionalServiceSchema(services: readonly string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${SITE_URL}/#service`,
    name: site.name,
    url: `${SITE_URL}/`,
    description: site.description,
    parentOrganization: { '@id': ORGANIZATION_ID },
    areaServed: [
      { '@type': 'Country', name: 'United States' },
      { '@type': 'Place', name: 'Latin America' },
    ],
    availableLanguage: ['English', 'Spanish'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Custom business software',
      itemListElement: services.map((service) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: service },
      })),
    },
  };
}

export function faqSchema(items: readonly { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
