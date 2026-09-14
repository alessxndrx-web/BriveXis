import { Container } from './ui/Container';

export function WhoWeAre() {
  return (
    <section id="about" className="py-24 lg:py-32 bg-ivory">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-charcoal mb-8 tracking-tight leading-tight">
              Technology should adapt to your business — not the other way around.
            </h2>
            <div className="w-12 h-1 bg-copper mb-8"></div>
            <p className="text-lg sm:text-xl text-muted mb-6 leading-relaxed">
              We work closely with growing companies to understand their unique operations, workflows, and bottlenecks before designing software. 
            </p>
            <p className="text-lg sm:text-xl text-muted leading-relaxed">
              Operating from Nicaragua, we serve businesses internationally, offering the direct collaboration and communication of an in-house team with the advantages of a nearshore technology partner.
            </p>
          </div>
          
          <div className="bg-white-surface border border-light-border p-8 sm:p-10 lg:p-12">
            <h3 className="text-xl font-bold text-charcoal mb-8">What We Build</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
              {[
                'Internal business platforms',
                'CRM systems',
                'Inventory systems',
                'Sales platforms',
                'Operational dashboards',
                'Workflow automation',
                'Web platforms',
                'Mobile applications'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-copper mt-0.5 text-sm font-bold">0{index + 1}</span>
                  <span className="text-charcoal font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
