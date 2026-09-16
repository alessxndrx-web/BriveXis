import { Hero } from '../components/Hero';
import { Problem } from '../components/Problem';
import { WhoWeAre } from '../components/WhoWeAre';
import { Solutions } from '../components/Solutions';
import { Industries } from '../components/Industries';
import { Demos } from '../components/Demos';
import { WhyBriveXis } from '../components/WhyBriveXis';
import { Process } from '../components/Process';
import { About } from '../components/About';
import { FAQ } from '../components/FAQ';
import { Contact } from '../components/Contact';
import { faqs } from '../data/faq';
import {
  faqSchema,
  organizationSchema,
  professionalServiceSchema,
  useDocumentMeta,
  useStructuredData,
  websiteSchema,
} from '../lib/seo';

/** Service names used by the ProfessionalService offer catalogue. */
const services = [
  'CRM & Sales Operations',
  'Inventory & Order Management',
  'Operational Management',
  'Dashboards & Reporting',
  'Process Automation',
  'Custom Internal Platforms',
] as const;

export function Home() {
  useDocumentMeta({
    title: 'BriveXis | Custom Business Software & Operational Systems',
    description:
      'BriveXis builds custom business software — CRM, inventory, operations, reporting and automation — designed around how your company actually works. Serving the U.S. and Latin America.',
    path: '/',
  });

  useStructuredData('ld-organization', organizationSchema());
  useStructuredData('ld-website', websiteSchema());
  useStructuredData('ld-service', professionalServiceSchema(services));
  useStructuredData('ld-faq', faqSchema(faqs));

  return (
    <>
      <Hero />
      <Problem />
      <WhoWeAre />
      <Solutions />
      <Industries />
      <Demos />
      <WhyBriveXis />
      <Process />
      <About />
      <FAQ />
      <Contact />
    </>
  );
}
