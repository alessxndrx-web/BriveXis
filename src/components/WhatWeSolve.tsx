import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { ArrowRight } from 'lucide-react';

export function WhatWeSolve() {
  const problems = [
    "Customer information lives in spreadsheets.",
    "Sales teams lose track of leads.",
    "Inventory numbers are difficult to trust.",
    "Managers lack real-time visibility.",
    "Employees repeat manual administrative work.",
    "Different departments use disconnected systems.",
    "Reports take hours or days to prepare."
  ];

  const transformations = [
    { from: "Disconnected processes", to: "One centralized operating system" },
    { from: "Manual follow-ups", to: "Structured workflows" },
    { from: "Scattered information", to: "Real-time visibility" },
    { from: "Generic software limitations", to: "Software adapted to the company" }
  ];

  return (
    <section className="py-24 lg:py-32 bg-white-surface border-y border-light-border">
      <Container>
        <SectionHeader 
          title="When your business grows, disconnected tools become expensive." 
          subtitle="Off-the-shelf software rarely fits your exact operational needs, leading to workarounds that slow your team down."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mt-16">
          <div className="lg:col-span-5">
            <h3 className="text-xl font-bold text-charcoal mb-8 uppercase tracking-wider text-sm">Common Bottlenecks</h3>
            <ul className="space-y-6">
              {problems.map((problem, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-1.5 h-1.5 bg-copper mt-2.5 shrink-0" />
                  <span className="text-lg text-muted">{problem}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="lg:col-span-7">
            <h3 className="text-xl font-bold text-charcoal mb-8 uppercase tracking-wider text-sm">The Transformation</h3>
            <div className="flex flex-col gap-3">
              {transformations.map((item, i) => (
                <div key={i} className="bg-ivory border border-light-border p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-copper/30">
                  <div className="text-muted font-medium text-lg w-full sm:w-[45%]">{item.from}</div>
                  <div className="hidden sm:flex text-copper shrink-0"><ArrowRight size={24} strokeWidth={1.5} /></div>
                  <div className="text-charcoal font-bold text-lg w-full sm:w-[45%] sm:text-right">{item.to}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
