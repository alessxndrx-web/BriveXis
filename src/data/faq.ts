/**
 * Frequently asked questions.
 *
 * Answers are stored as plain strings because the same text feeds both the
 * rendered section and the FAQPage structured data. Keep them factual: no
 * delivery times, prices, support guarantees or outcomes we have not committed
 * to in writing.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: FaqItem[] = [
  {
    question: 'What types of businesses does BriveXis work with?',
    answer:
      'We work with operations-heavy companies — contractors and field service businesses, dealers and automotive businesses, and distribution and wholesale operations. What they have in common is that scheduling, inventory and customer commitments all have to stay in sync. We also take on other businesses with the same operational shape.',
  },
  {
    question: 'Do you only build completely custom software?',
    answer:
      'We build custom systems, but that does not mean rebuilding everything from zero. Where a tool your team already relies on works well, the sensible approach is usually to connect to it rather than replace it. The custom part is the operational layer that no off-the-shelf product covers correctly.',
  },
  {
    question: 'Can you replace spreadsheets and disconnected tools?',
    answer:
      'That is the most common reason companies come to us. Spreadsheets, shared inboxes and standalone tools each work on their own; the cost appears in the gaps between them. We consolidate the information and the steps that move between those tools into one system, and we migrate the existing data as part of the project.',
  },
  {
    question: 'Can BriveXis integrate with software we already use?',
    answer:
      'Yes, where the other system offers an API or a supported data exchange. Accounting, payment, email and e-commerce platforms are the ones we are asked about most often. We confirm what is technically possible for your specific tools during the first stage, before anything is scoped or committed.',
  },
  {
    question: 'Do you work with companies in the United States?',
    answer:
      'Yes. We are based in Managua, Nicaragua and operate on UTC-6, which overlaps with U.S. business hours across every time zone. Projects run in English or Spanish, and collaboration is remote-first with scheduled reviews at each stage.',
  },
  {
    question: 'What happens before development begins?',
    answer:
      'We start by understanding how the operation runs today — the steps, the people, the tools and where the work actually stalls. That review is what defines the scope. You see the workflow map and the system structure, and agree on them, before any code is written.',
  },
  {
    question: 'Do you provide support after launch?',
    answer:
      'Yes. Launch includes helping the team adopt the system, and we stay involved afterwards to fix issues and extend the software as the operation changes. The specific arrangement — scope, availability and duration — is agreed per project rather than sold as a fixed package.',
  },
];
