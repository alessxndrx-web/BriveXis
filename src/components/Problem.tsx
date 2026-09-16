import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal, Stagger, StaggerItem } from './ui/Reveal';
import { OperationShift } from './visuals/OperationShift';

const symptoms = [
  'Customer information is scattered across spreadsheets and inboxes.',
  'Leads arrive through several channels and get lost between them.',
  'Inventory numbers cannot be trusted without manual verification.',
  'Reporting takes hours because the data has to be assembled by hand.',
  'Employees repeat the same administrative task in three places.',
  'Departments work in software that does not talk to each other.',
];

export function Problem() {
  return (
    <section
      id="problem"
      aria-labelledby="problem-title"
      className="bg-white-surface border-b border-light-border py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 xl:gap-16">
          <div className="lg:col-span-6">
            <SectionHeader
              index="01"
              eyebrow="The problem"
              titleId="problem-title"
              title={
                <>
                  Growing businesses rarely break because they lack software.{' '}
                  <span className="text-muted">
                    They break because their systems stop working together.
                  </span>
                </>
              }
              titleClassName="max-w-[16ch]"
              lead="Each tool usually works on its own. The cost shows up in the space between them — in the re-typing, the checking and the information nobody can find."
            />
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <Reveal>
              <h3 className="text-eyebrow uppercase text-muted mb-6">
                What it looks like day to day
              </h3>
            </Reveal>
            <Stagger as="ul" delay={0.1} className="border-t border-light-border">
              {symptoms.map((symptom, i) => (
                <StaggerItem
                  as="li"
                  key={symptom}
                  className="grid grid-cols-[2.25rem_1fr] gap-2 border-b border-light-border py-4"
                >
                  <span className="text-ui font-semibold text-copper tabular-nums pt-1">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-charcoal/85">{symptom}</span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </div>

        <div className="mt-16 lg:mt-24">
          <OperationShift />
        </div>
      </Container>
    </section>
  );
}
