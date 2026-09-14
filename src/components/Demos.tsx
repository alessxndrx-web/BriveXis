import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { ArrowRight } from 'lucide-react';

export function Demos() {
  const demos = [
    {
      title: "Contractor Operations",
      desc: "A centralized workspace for leads, estimates, jobs, crews, invoices and customer follow-up.",
      industry: "Field Services"
    },
    {
      title: "Dealer Operations",
      desc: "Inventory, leads, customer management, reservations and sales operations in one platform.",
      industry: "Automotive"
    },
    {
      title: "Distribution Operations",
      desc: "Purchasing, inventory, orders, customers and reporting for growing distribution businesses.",
      industry: "Wholesale"
    }
  ];

  return (
    <section id="demos" className="py-24 lg:py-32 bg-white-surface border-y border-light-border">
      <Container>
        <SectionHeader 
          title="See how better operations could look."
          subtitle="We are building interactive examples focused on real operational workflows across different industries."
          align="left"
        />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {demos.map((demo, idx) => (
            <div key={idx} className="group border border-light-border bg-ivory overflow-hidden flex flex-col h-full">
              <div className="aspect-[4/3] bg-light-border/30 relative flex items-center justify-center p-6 border-b border-light-border">
                {/* Placeholder for future system preview/thumbnail */}
                <div className="absolute inset-4 border border-dashed border-charcoal/10 rounded-sm flex items-center justify-center bg-white-surface/50">
                   <span className="text-sm font-bold text-muted tracking-widest uppercase">Demo in development</span>
                </div>
              </div>
              <div className="p-8 flex-grow flex flex-col">
                <div className="text-xs font-bold uppercase tracking-wider text-copper mb-3">{demo.industry}</div>
                <h3 className="text-xl font-bold text-charcoal mb-4">{demo.title}</h3>
                <p className="text-muted leading-relaxed mb-8 flex-grow">{demo.desc}</p>
                <div className="flex items-center text-sm font-bold text-muted transition-colors group-hover:text-copper cursor-not-allowed">
                  <span>Launch Demo</span>
                  <ArrowRight size={16} className="ml-2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
