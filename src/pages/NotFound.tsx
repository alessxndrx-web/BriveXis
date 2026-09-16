import { Container } from '../components/ui/Container';
import { Button } from '../components/ui/Button';
import { CONTACT_ANCHOR, routes } from '../config/site';
import { useDocumentMeta } from '../lib/seo';

export function NotFound() {
  useDocumentMeta({
    title: 'Page not found | BriveXis',
    description: 'The page you were looking for does not exist.',
    path: '/404',
    noindex: true,
  });

  return (
    <div className="bg-midnight min-h-[80vh] flex items-center pt-28 pb-20">
      <Container>
        <div className="flex items-center gap-3 mb-7">
          <span aria-hidden="true" className="h-px w-8 bg-copper" />
          <span className="text-eyebrow uppercase text-copper-highlight">404</span>
        </div>
        <h1 className="text-section font-semibold text-white-surface max-w-[18ch]">
          This page does not exist.
        </h1>
        <p className="mt-6 text-lead text-muted-dark max-w-[48ch]">
          The link may be out of date. Everything on the site is reachable from the home
          page.
        </p>
        <div className="mt-9 flex flex-col sm:flex-row gap-3">
          <Button href={routes.home} variant="solid-invert" className="w-full sm:w-auto">
            Back to home
          </Button>
          <Button href={CONTACT_ANCHOR} variant="outline-invert" className="w-full sm:w-auto">
            Discuss Your Project
          </Button>
        </div>
      </Container>
    </div>
  );
}
