import { Container } from './ui/Container';

export function Nearshore() {
  const points = [
    "Compatible U.S. working hours",
    "English and Spanish collaboration",
    "Remote-first delivery",
    "Direct communication",
    "International project capability"
  ];

  return (
    <section className="py-24 lg:py-32 bg-ivory">
      <Container>
        <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          <div className="lg:w-1/2">
            <h2 className="text-3xl sm:text-4xl font-bold text-charcoal mb-6 tracking-tight leading-tight">
              Built in Nicaragua. <br/>Designed for businesses anywhere.
            </h2>
            <div className="w-12 h-1 bg-copper mb-8"></div>
            <p className="text-lg text-muted mb-8 leading-relaxed">
              We leverage our nearshore location to provide high-quality software engineering with seamless communication, allowing you to work with a dedicated team in a compatible time zone.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              {points.map((point, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 bg-copper shrink-0" />
                  <span className="text-charcoal font-medium">{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:w-1/2 w-full h-64 lg:h-auto lg:aspect-square bg-white-surface border border-light-border flex items-center justify-center p-8 max-h-[500px]">
             <div className="w-full h-full border border-dashed border-dark-border/10 flex items-center justify-center relative">
                <div className="w-48 h-48 rounded-full border border-light-border flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full border border-light-border flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border border-light-border bg-ivory"></div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
