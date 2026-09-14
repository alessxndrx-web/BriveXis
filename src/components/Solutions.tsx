import { Container } from './ui/Container';

export function Solutions() {
  const solutions = [
    {
      title: "Business Management Systems",
      desc: "Unified platforms that bring together separate operations, allowing you to run your entire company from a single, secure environment."
    },
    {
      title: "CRM & Sales Operations",
      desc: "Centralize leads, customer information, follow-ups, activities and sales pipelines in one system designed around your specific sales process."
    },
    {
      title: "Inventory & Order Management",
      desc: "Track stock levels in real-time, automate reordering processes, and manage fulfillment without relying on error-prone spreadsheets."
    },
    {
      title: "Dashboards & Reporting",
      desc: "Transform raw operational data into clear, automated executive dashboards for better and faster decision-making."
    },
    {
      title: "Process Automation",
      desc: "Eliminate repetitive administrative work by programming your system to handle routine tasks, approvals and notifications automatically."
    },
    {
      title: "Custom Internal Tools",
      desc: "Replace fragmented third-party apps with focused tools built exactly for the specific tasks your employees perform daily."
    }
  ];

  return (
    <section id="solutions" className="py-24 lg:py-32 bg-ivory">
      <Container>
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24">
          <div className="lg:w-1/3">
            <div className="sticky top-32">
              <h2 className="text-3xl sm:text-4xl font-bold text-charcoal mb-6 tracking-tight leading-tight">
                Systems built for your operations.
              </h2>
              <div className="w-12 h-1 bg-copper mb-8"></div>
              <p className="text-lg text-muted leading-relaxed">
                We do not sell pre-packaged subscriptions. We architect and build the exact software infrastructure your company needs to scale efficiently.
              </p>
            </div>
          </div>
          <div className="lg:w-2/3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
              {solutions.map((sol, idx) => (
                <div key={idx} className="bg-white-surface border border-light-border p-8 hover:border-copper/40 transition-colors">
                  <h3 className="text-xl font-bold text-charcoal mb-4">{sol.title}</h3>
                  <p className="text-muted leading-relaxed">{sol.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
