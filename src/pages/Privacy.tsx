import { ReactNode } from 'react';
import { Container } from '../components/ui/Container';
import { Reveal } from '../components/ui/Reveal';
import { contactDetails, site } from '../config/site';
import { useDocumentMeta } from '../lib/seo';

/**
 * Privacy notice.
 *
 * Informational website copy describing what the inquiry form actually does.
 * It deliberately makes no regulatory compliance claim, because none has been
 * legally reviewed. Keep it that way: describe the practice, do not certify it.
 */

/** Shown as the effective date. Update whenever the practices below change. */
const LAST_UPDATED = 'September 14, 2026';

/** Two-column editorial row, matching the layout used across the home page. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-4 border-t border-light-border py-8 sm:py-10">
      <h2 className="lg:col-span-4 font-heading font-semibold text-[1.25rem] sm:text-[1.375rem] text-charcoal max-w-[24ch]">
        {title}
      </h2>
      <div className="lg:col-span-8 space-y-4 text-muted max-w-[64ch]">{children}</div>
    </section>
  );
}

export function Privacy() {
  useDocumentMeta({
    title: 'Privacy | BriveXis',
    description:
      'How BriveXis handles the information submitted through its project inquiry form: what is collected, why, how it is used and how to ask for it to be removed.',
    path: '/privacy',
  });

  return (
    <div className="bg-white-surface">
      {/* Clears the fixed header, which is transparent over the midnight hero
          on the home page but needs a solid backdrop here. */}
      <div className="bg-midnight pt-28 sm:pt-32 lg:pt-36 pb-16 lg:pb-20">
        <Container>
          <div className="flex items-center gap-3 mb-7">
            <span aria-hidden="true" className="h-px w-8 bg-copper" />
            <span className="text-eyebrow uppercase text-copper-highlight">Privacy</span>
          </div>
          <h1 className="text-section font-semibold text-white-surface max-w-[20ch]">
            How we handle the information you send us.
          </h1>
          <p className="mt-6 text-lead text-muted-dark max-w-[58ch]">
            This notice explains what happens to the details submitted through the project
            inquiry form on this website.
          </p>
          <p className="mt-8 text-ui text-muted-dark/80">Last updated: {LAST_UPDATED}</p>
        </Container>
      </div>

      <Container className="py-16 lg:py-24">
        <Reveal>
          <div>
            <Section title="What this notice covers">
              <p>
                This notice applies to this website and to the project inquiries submitted
                through it. It does not cover the systems we build for clients, which are
                governed by the agreement for each project.
              </p>
            </Section>

            <Section title="What we collect">
              <p>
                When you submit the project inquiry form, we receive the information you
                enter: your name, company, work email address, phone number if you provide
                one, the industry and improvement area you select, your preferred contact
                method if you choose one, and the project description you write.
              </p>
              <p>
                Our server also records standard technical information that accompanies any
                web request, such as the IP address the submission came from and the time it
                was received. We use it to keep the form working and to limit automated
                abuse.
              </p>
              <p>
                We do not use advertising trackers, and we do not sell or share inquiry
                information with third parties for marketing.
              </p>
            </Section>

            <Section title="Why we collect it">
              <p>
                We collect these details for one purpose: to understand your operation well
                enough to respond usefully and to discuss whether a custom system is the
                right solution. The industry, improvement area and description exist so that
                our reply addresses your actual situation rather than a generic one.
              </p>
            </Section>

            <Section title="How we use it">
              <p>
                Inquiry details are delivered to our team by email and used to prepare and
                send a reply, and to continue the conversation if it leads to a project. If
                a project goes ahead, the same information becomes part of that project
                record.
              </p>
              <p>
                We do not add you to a marketing list as a result of submitting the form.
              </p>
            </Section>

            <Section title="Service providers">
              <p>
                Delivering an inquiry involves two kinds of infrastructure: the hosting
                provider that runs this website, and a third-party email delivery provider
                that transmits the inquiry to our inbox. Your submission passes through
                those services in order to reach us, and each processes it under its own
                terms.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                We keep inquiry correspondence for as long as it is relevant to the
                conversation or to an ongoing working relationship, and we remove inquiries
                that did not lead to one when they are no longer useful to us. Technical
                request records are short-lived and are not retained as a permanent log.
              </p>
            </Section>

            <Section title="Your choices">
              <p>
                You can ask us what we hold about you, ask us to correct it, or ask us to
                delete it. Contact us{' '}
                {contactDetails.email ? (
                  <>
                    at{' '}
                    <a
                      href={`mailto:${contactDetails.email}`}
                      className="text-charcoal underline underline-offset-2 decoration-copper"
                    >
                      {contactDetails.email}
                    </a>{' '}
                    and we will
                  </>
                ) : (
                  <>
                    through the inquiry form on this site, noting the request in the project
                    description, and we will
                  </>
                )}{' '}
                confirm what we have done. We may need to verify that the request comes from
                the person the information belongs to before acting on it.
              </p>
              <p>
                This is an informational description of our practices. It is not a statement
                of compliance with any particular data protection regulation, and it is not
                legal advice.
              </p>
            </Section>

            <Section title="Changes to this notice">
              <p>
                If our practices change, we will update this page and revise the date shown
                above. {site.name} is based in {site.location.label}.
              </p>
            </Section>
          </div>
        </Reveal>
      </Container>
    </div>
  );
}
