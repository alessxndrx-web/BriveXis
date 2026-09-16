import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal } from './ui/Reveal';

const collaboration = [
  {
    label: 'UTC-6',
    title: 'Compatible U.S. working hours',
    desc: 'Overlapping schedules, so questions are answered inside the same working day.',
  },
  {
    label: 'EN / ES',
    title: 'Bilingual communication',
    desc: 'Project work, documentation and meetings in English or Spanish.',
  },
  {
    label: 'Direct',
    title: 'Work with the development team',
    desc: 'You talk to the people designing and building the system, not to intermediaries.',
  },
  {
    label: 'Remote-first',
    title: 'Structured project delivery',
    desc: 'Defined stages, scheduled reviews and a documented system at every step.',
  },
];

export function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="bg-ivory py-20 sm:py-24 lg:py-32">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-5">
            <SectionHeader
              index="08"
              eyebrow="About"
              titleId="about-title"
              title={
                <>
                  Built in Nicaragua.{' '}
                  <span className="text-muted">
                    Working alongside businesses across the U.S. and Latin America.
                  </span>
                </>
              }
              titleClassName="max-w-[17ch]"
            />
            <Reveal delay={0.14}>
              <p className="mt-8 text-lead text-muted max-w-[46ch]">
                We are a small engineering team by design. Projects are taken on when we can
                understand the operation properly and stay involved after launch — which is
                what makes a custom system worth building in the first place.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={0.08}>
              <h3 className="text-eyebrow uppercase text-muted mb-5">How we work together</h3>
              <dl className="border-t border-light-border">
                {collaboration.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-y-2 gap-x-6 border-b border-light-border py-6"
                  >
                    <dt className="font-heading font-semibold text-charcoal text-[1.0625rem] tracking-tight">
                      {item.label}
                    </dt>
                    <dd>
                      <span className="block font-medium text-charcoal">{item.title}</span>
                      <span className="mt-1 block text-ui leading-relaxed text-muted max-w-[48ch]">
                        {item.desc}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
