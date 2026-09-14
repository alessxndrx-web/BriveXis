import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';

export function Industries() {
  const industries = [
    "Contractors & Field Services",
    "Dealers & Automotive Businesses",
    "Distribution & Wholesale",
    "Property & Service Management",
    "Growing SMEs"
  ];

  return (
    <section id="industries" className="py-24 bg-ivory border-t border-light-border">
      <Container>
        <SectionHeader 
          title="Designed for complex operations."
          subtitle="While we build systems for any operationally intensive business, we have deep experience streamlining workflows in these sectors."
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
          {industries.map((ind, idx) => (
            <div key={idx} className="border-b border-light-border py-4 flex items-center">
              <div className="w-1.5 h-1.5 bg-copper mr-4 shrink-0" />
              <span className="text-lg font-bold text-charcoal">{ind}</span>
            </div>
          ))}
          <div className="border-b border-light-border py-4 flex items-center">
            <div className="w-1.5 h-1.5 bg-muted mr-4 shrink-0" />
            <span className="text-lg font-bold text-muted">Adaptable to other industries</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
