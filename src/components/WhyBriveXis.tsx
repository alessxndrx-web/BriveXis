import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';

export function WhyBriveXis() {
  const reasons = [
    {
      title: "Built around your workflow",
      desc: "We study how your operation works before deciding what to build."
    },
    {
      title: "Direct collaboration",
      desc: "Work directly with the people designing and developing your system."
    },
    {
      title: "Nearshore advantage",
      desc: "Close U.S. time zones make communication and collaboration easier."
    },
    {
      title: "Bilingual communication",
      desc: "English and Spanish communication for teams operating across the U.S. and Latin America."
    },
    {
      title: "Scalable architecture",
      desc: "Systems designed to grow with your operation rather than becoming another temporary workaround."
    },
    {
      title: "Practical development",
      desc: "We prioritize software that employees can actually use every day."
    }
  ];

  return (
    <section id="why-us" className="py-24 lg:py-32 bg-midnight border-b border-dark-border">
      <Container>
        <SectionHeader 
          title="Why companies partner with BriveXis."
          dark={true}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16 mt-16">
          {reasons.map((reason, idx) => (
            <div key={idx} className="relative">
              <div className="text-copper mb-5 font-heading font-bold text-lg border-b border-dark-border pb-4">
                0{idx + 1}
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-wide">{reason.title}</h3>
              <p className="text-muted-dark leading-relaxed">{reason.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
