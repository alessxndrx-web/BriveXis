import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';

export function Process() {
  const steps = [
    {
      title: "Understand",
      desc: "We learn how your business currently operates, where bottlenecks exist and what needs to improve."
    },
    {
      title: "Design",
      desc: "We define workflows, system architecture and user experience before development."
    },
    {
      title: "Build",
      desc: "We develop the system in structured iterations with continuous feedback."
    },
    {
      title: "Launch & Improve",
      desc: "We deploy the solution, support adoption and continue improving it as the business evolves."
    }
  ];

  return (
    <section id="process" className="py-24 lg:py-32 bg-dark-surface border-b border-dark-border">
      <Container>
        <SectionHeader 
          title="Our development process."
          dark={true}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mt-16">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              {idx !== steps.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-16 right-0 h-px bg-dark-border"></div>
              )}
              <div className="w-12 h-12 rounded-full bg-midnight border border-dark-border flex items-center justify-center text-copper font-bold font-heading mb-6 relative z-10">
                0{idx + 1}
              </div>
              <h3 className="text-xl font-bold text-white mb-4">{step.title}</h3>
              <p className="text-muted-dark leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
