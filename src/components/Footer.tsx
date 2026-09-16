import { Container } from './ui/Container';
import { BriveXisLogo } from './ui/BriveXisLogo';
import { contactDetails, footerNav, routes, site } from '../config/site';

/** Hairline that draws in under a link on hover. */
const underline =
  'absolute -bottom-0.5 inset-x-0 h-px bg-copper origin-left scale-x-0 ' +
  'transition-transform duration-300 group-hover:scale-x-100';

const linkStyles =
  'group relative inline-block text-muted-dark transition-colors duration-200 hover:text-white-surface';

export function Footer() {
  return (
    <footer className="bg-midnight border-t border-dark-border pt-16 lg:pt-20 pb-10">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-8">
          <div className="md:col-span-5">
            <a href={routes.home} aria-label="BriveXis — home" className="inline-block">
              <BriveXisLogo variant="full" theme="dark" size={24} />
            </a>
            <p className="mt-5 text-muted-dark max-w-[32ch]">{site.tagline}</p>

            {contactDetails.email && (
              <a href={`mailto:${contactDetails.email}`} className={`${linkStyles} mt-5`}>
                {contactDetails.email}
                <span aria-hidden="true" className={underline} />
              </a>
            )}
          </div>

          <nav aria-label="Footer" className="md:col-span-3">
            <h2 className="text-eyebrow uppercase text-muted-dark/70 mb-5">Navigation</h2>
            <ul className="space-y-3">
              {footerNav.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className={linkStyles}>
                    {link.name}
                    <span aria-hidden="true" className={underline} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="md:col-span-4">
            <h2 className="text-eyebrow uppercase text-muted-dark/70 mb-5">Location</h2>
            <p className="font-medium text-white-surface">{site.location.label}</p>
            <p className="mt-2 text-muted-dark max-w-[34ch]">{site.serves}</p>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-ui text-muted-dark">
            &copy; {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>

          <div className="flex items-center gap-6">
            <a href={routes.privacy} className={`${linkStyles} text-ui`}>
              Privacy
              <span aria-hidden="true" className={underline} />
            </a>
            <a href="#top" className={`${linkStyles} text-ui`}>
              Back to top
              <span aria-hidden="true" className={underline} />
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
