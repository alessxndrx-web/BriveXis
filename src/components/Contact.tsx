import { FormEvent, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal } from './ui/Reveal';
import { Button } from './ui/Button';
import { SelectField, TextAreaField, TextField } from './ui/Field';
import { InquiryError, submitProjectInquiry } from '../lib/contact';
import {
  CONTACT_METHOD_OPTIONS,
  DESCRIPTION_MIN,
  FIELD_LIMITS,
  GOAL_OPTIONS,
  INDUSTRY_OPTIONS,
  InquiryErrors,
  ProjectInquiry,
  emptyInquiry,
  validateInquiry,
} from '../lib/inquiry';
import { createOnceTracker, track } from '../lib/analytics';

const nextSteps = [
  'We review your operation and how it works today.',
  'We identify the main bottleneck and what it is costing.',
  'We discuss the technical approach that fits it best.',
];

type SubmitStatus = 'idle' | 'submitting' | 'sent' | 'failed';

/** Validation walks the fields in this order to focus the first one that fails. */
const fieldOrder: (keyof ProjectInquiry)[] = [
  'name',
  'company',
  'email',
  'phone',
  'industry',
  'goal',
  'preferredContact',
  'description',
];

const controlId = (field: keyof ProjectInquiry) => `inquiry-${field}`;

export function Contact() {
  const [inquiry, setInquiry] = useState<ProjectInquiry>(emptyInquiry);
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [failureMessage, setFailureMessage] = useState('');
  const trackOnce = useRef(createOnceTracker()).current;
  const confirmationRef = useRef<HTMLDivElement>(null);

  // The form is tall and the confirmation that replaces it is short, so on a
  // successful send the panel collapses and the message would otherwise land
  // above the viewport. Bring it into view and give it focus.
  useEffect(() => {
    if (status !== 'sent') return;
    const panel = confirmationRef.current;
    if (!panel) return;
    panel.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'center',
    });
    panel.focus({ preventScroll: true });
  }, [status]);

  const update = (field: keyof ProjectInquiry) => (value: string) => {
    trackOnce('inquiry_start');
    setInquiry((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status === 'failed') setStatus('idle');
  };

  const focusFirstError = (validationErrors: InquiryErrors) => {
    const first = fieldOrder.find((field) => validationErrors[field]);
    if (first) document.getElementById(controlId(first))?.focus();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateInquiry(inquiry);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setStatus('idle');
      focusFirstError(validationErrors);
      return;
    }

    setStatus('submitting');
    try {
      await submitProjectInquiry(inquiry);
      setInquiry(emptyInquiry);
      setStatus('sent');
      track('inquiry_submit_success', { industry: inquiry.industry, goal: inquiry.goal });
    } catch (error) {
      setFailureMessage(
        error instanceof InquiryError
          ? error.message
          : 'Something went wrong while sending your details. Please try again.',
      );
      setStatus('failed');
      track('inquiry_submit_error');
    }
  };

  const submitting = status === 'submitting';

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="bg-white-surface border-t border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              index="10"
              eyebrow="Project inquiry"
              titleId="contact-title"
              title="Your business should not have to work around its software."
              titleClassName="max-w-[15ch]"
            />
            <Reveal delay={0.14}>
              <p className="mt-7 text-lead text-muted max-w-[48ch]">
                Tell us where your operation is losing time, visibility or control. We will
                help determine whether a custom system is the right solution.
              </p>

              <div className="mt-12">
                <h3 className="text-eyebrow uppercase text-muted mb-5">What happens next</h3>
                <ol className="border-t border-light-border">
                  {nextSteps.map((step, i) => (
                    <li
                      key={step}
                      className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-light-border py-4"
                    >
                      <span className="text-ui font-semibold tabular-nums text-copper pt-1">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-charcoal/85">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <Reveal delay={0.08}>
              <div className="border border-light-border rounded-[4px] bg-ivory">
                <div className="flex items-center gap-3 border-b border-light-border px-6 sm:px-8 lg:px-10 py-5">
                  <span aria-hidden="true" className="w-1.5 h-1.5 bg-copper" />
                  <h3 className="font-heading font-semibold text-[1.125rem] text-charcoal">
                    Project Inquiry
                  </h3>
                </div>

                {status === 'sent' ? (
                  <div
                    ref={confirmationRef}
                    role="status"
                    tabIndex={-1}
                    className="px-6 sm:px-8 lg:px-10 py-12 focus:outline-none"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center justify-center w-10 h-10 rounded-[2px] border border-copper/40 text-copper"
                    >
                      <Check size={20} strokeWidth={2} />
                    </span>
                    <h4 className="mt-6 font-heading font-semibold text-[1.25rem] text-charcoal max-w-[26ch]">
                      Thanks &mdash; your project details were sent successfully.
                    </h4>
                    <p className="mt-3 text-muted max-w-[46ch]">
                      We will review your operation and get back to you.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatus('idle')}
                      className="mt-7 text-ui font-medium text-charcoal underline underline-offset-4 decoration-copper hover:decoration-charcoal"
                    >
                      Send another inquiry
                    </button>
                  </div>
                ) : (
                  <form
                    noValidate
                    onSubmit={handleSubmit}
                    className="px-6 sm:px-8 lg:px-10 py-8 space-y-6"
                  >
                    {/* Honeypot: hidden from people and assistive technology alike, so
                        any value means an automated filler completed every field. */}
                    <div aria-hidden="true" className="absolute w-px h-px -m-px overflow-hidden">
                      <label htmlFor="inquiry-website">Website</label>
                      <input
                        id="inquiry-website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={inquiry.website ?? ''}
                        onChange={(e) =>
                          setInquiry((current) => ({ ...current, website: e.target.value }))
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <TextField
                        id={controlId('name')}
                        name="name"
                        label="Name"
                        autoComplete="name"
                        maxLength={FIELD_LIMITS.name}
                        disabled={submitting}
                        value={inquiry.name}
                        error={errors.name}
                        onChange={(e) => update('name')(e.target.value)}
                      />
                      <TextField
                        id={controlId('company')}
                        name="company"
                        label="Company"
                        autoComplete="organization"
                        maxLength={FIELD_LIMITS.company}
                        disabled={submitting}
                        value={inquiry.company}
                        error={errors.company}
                        onChange={(e) => update('company')(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <TextField
                        id={controlId('email')}
                        name="email"
                        type="email"
                        label="Work email"
                        autoComplete="email"
                        maxLength={FIELD_LIMITS.email}
                        disabled={submitting}
                        value={inquiry.email}
                        error={errors.email}
                        onChange={(e) => update('email')(e.target.value)}
                      />
                      <TextField
                        id={controlId('phone')}
                        name="phone"
                        type="tel"
                        label="Phone"
                        optional
                        autoComplete="tel"
                        maxLength={FIELD_LIMITS.phone}
                        disabled={submitting}
                        value={inquiry.phone}
                        error={errors.phone}
                        onChange={(e) => update('phone')(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <SelectField
                        id={controlId('industry')}
                        name="industry"
                        label="Industry"
                        options={INDUSTRY_OPTIONS}
                        placeholder="Select your industry"
                        disabled={submitting}
                        value={inquiry.industry}
                        error={errors.industry}
                        onChange={(e) => update('industry')(e.target.value)}
                      />
                      <SelectField
                        id={controlId('preferredContact')}
                        name="preferredContact"
                        label="Preferred contact"
                        optional
                        options={CONTACT_METHOD_OPTIONS}
                        placeholder="How should we reply?"
                        disabled={submitting}
                        value={inquiry.preferredContact}
                        error={errors.preferredContact}
                        onChange={(e) => update('preferredContact')(e.target.value)}
                      />
                    </div>

                    <SelectField
                      id={controlId('goal')}
                      name="goal"
                      label="What would you like to improve?"
                      options={GOAL_OPTIONS}
                      placeholder="Select the main area"
                      disabled={submitting}
                      value={inquiry.goal}
                      error={errors.goal}
                      onChange={(e) => update('goal')(e.target.value)}
                    />

                    <TextAreaField
                      id={controlId('description')}
                      name="description"
                      label="Project description"
                      rows={5}
                      minLength={DESCRIPTION_MIN}
                      maxLength={FIELD_LIMITS.description}
                      disabled={submitting}
                      placeholder="How does the process work today, and where does it break down?"
                      value={inquiry.description}
                      error={errors.description}
                      onChange={(e) => update('description')(e.target.value)}
                    />

                    <div className="pt-2">
                      <Button type="submit" variant="solid" fullWidth disabled={submitting}>
                        {submitting ? 'Sending…' : 'Send Project Details'}
                      </Button>
                    </div>

                    <div aria-live="polite" className="empty:hidden">
                      {status === 'failed' && (
                        <p className="text-ui text-danger">{failureMessage}</p>
                      )}
                    </div>

                    <p className="text-ui text-muted border-t border-light-border pt-5">
                      We only use this information to respond to your project inquiry. See our{' '}
                      <a
                        href="/privacy"
                        className="text-charcoal underline underline-offset-2 decoration-light-border hover:decoration-charcoal"
                      >
                        privacy notice
                      </a>
                      .
                    </p>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
