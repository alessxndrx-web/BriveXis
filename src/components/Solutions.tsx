import { Container } from './ui/Container';
import { SectionHeader } from './ui/SectionHeader';
import { Reveal } from './ui/Reveal';
import { WorkflowChain } from './ui/WorkflowChain';

interface Solution {
  title: string;
  desc: string;
  examples: string[];
  workflow: string[];
}

const solutions: Solution[] = [
  {
    title: 'CRM & Sales Operations',
    desc: 'Centralize leads, customer information, follow-ups, activities and sales pipelines around your real sales process.',
    examples: ['Pipeline stages', 'Activity history', 'Quote follow-up'],
    workflow: ['Lead intake', 'Qualification', 'Follow-up', 'Sale', 'Customer history'],
  },
  {
    title: 'Inventory & Order Management',
    desc: 'Keep stock, purchasing and fulfillment in one place so quantities stay reliable and orders stop depending on manual checks.',
    examples: ['Stock movements', 'Reorder rules', 'Order status'],
    workflow: ['Purchasing', 'Receiving', 'Stock', 'Orders', 'Fulfillment'],
  },
  {
    title: 'Operational Management',
    desc: 'Run jobs, schedules, teams and service records inside a structure that reflects how work is actually assigned and completed.',
    examples: ['Job records', 'Team assignment', 'Completion tracking'],
    workflow: ['Request', 'Scheduling', 'Assignment', 'Execution', 'Closure'],
  },
  {
    title: 'Dashboards & Reporting',
    desc: 'Turn the information your system already captures into reporting that managers can read without rebuilding a spreadsheet.',
    examples: ['Operational views', 'Scheduled reports', 'Exportable records'],
    workflow: ['Data capture', 'Consolidation', 'Dashboard', 'Review'],
  },
  {
    title: 'Process Automation',
    desc: 'Remove repetitive administrative work by letting the system handle routine steps, approvals and notifications.',
    examples: ['Approval routing', 'Status notifications', 'Document generation'],
    workflow: ['Trigger', 'Rule', 'Action', 'Notification', 'Record'],
  },
  {
    title: 'Custom Internal Platforms',
    desc: 'Replace a stack of disconnected tools with one internal platform shaped around your roles, permissions and operating structure.',
    examples: ['Role-based access', 'Module structure', 'System integrations'],
    workflow: ['Roles', 'Permissions', 'Modules', 'Integrations', 'Rollout'],
  },
];

export function Solutions() {
  return (
    <section
      id="solutions"
      aria-labelledby="solutions-title"
      className="bg-midnight py-20 sm:py-24 lg:py-32"
    >
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 mb-14 lg:mb-20">
          <div className="lg:col-span-6">
            <SectionHeader
              index="03"
              eyebrow="Solutions"
              titleId="solutions-title"
              title="Systems built around your operation."
              titleClassName="max-w-[13ch]"
              dark
            />
          </div>
          <div className="lg:col-span-5 lg:col-start-8 lg:self-end">
            <Reveal delay={0.08}>
              <p className="border-t border-dark-border pt-6 text-lead text-muted-dark">
                We don&rsquo;t force your operation into a pre-packaged system. Each solution is
                designed around the workflows your business actually depends on and built to
                evolve as the operation grows.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="border-t border-dark-border">
          {solutions.map((solution, i) => (
            <Reveal key={solution.title} y={10}>
              <article className="group grid grid-cols-1 lg:grid-cols-12 gap-y-5 gap-x-10 border-b border-dark-border py-8 lg:py-10 transition-colors hover:bg-white/[0.025]">
                <div className="lg:col-span-1">
                  <span className="text-ui font-semibold tabular-nums text-copper/75 transition-colors duration-200 group-hover:text-copper">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="lg:col-span-4">
                  <h3 className="text-stage font-semibold text-white-surface/90 max-w-[16ch] transition-colors duration-200 group-hover:text-white-surface">
                    {solution.title}
                  </h3>
                </div>

                <div className="lg:col-span-7">
                  <p className="text-muted-dark max-w-[58ch]">{solution.desc}</p>

                  <ul className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {solution.examples.map((example, index) => (
                      <li key={example} className="flex items-center gap-2 text-ui text-muted-dark/80">
                        {example}
                        {index < solution.examples.length - 1 && (
                          <span aria-hidden="true" className="w-1 h-1 rounded-full bg-dark-border" />
                        )}
                      </li>
                    ))}
                  </ul>

                  <WorkflowChain
                    steps={solution.workflow}
                    tone="dark"
                    animate
                    interactive
                    className="mt-6"
                  />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
