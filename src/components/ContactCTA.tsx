import { Container } from './ui/Container';
import { Button } from './ui/Button';

export function ContactCTA() {
  return (
    <section id="contact" className="py-24 lg:py-32 bg-white-surface border-t border-light-border">
      <Container>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-charcoal mb-8 tracking-tight leading-tight">
            Your business should not have to work around its software.
          </h2>
          <p className="text-lg sm:text-xl text-muted mb-12 leading-relaxed max-w-2xl mx-auto">
            Tell us how your operation works today and where the friction is. We can help determine whether a custom system makes sense.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button className="w-full sm:w-auto">Discuss Your Project</Button>
            <Button variant="outline" className="w-full sm:w-auto">Contact BriveXis</Button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-24 bg-ivory border border-light-border p-8 sm:p-12">
          <h3 className="text-2xl font-bold text-charcoal mb-8 text-center">Project Inquiry</h3>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Name</label>
                <input type="text" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Company</label>
                <input type="text" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Work Email</label>
                <input type="email" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-2">Phone (optional)</label>
                <input type="tel" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Industry</label>
              <input type="text" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">What would you like to improve?</label>
              <input type="text" className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-medium text-charcoal mb-2">Project description</label>
              <textarea rows={4} className="w-full bg-white-surface border border-light-border px-4 py-3 focus:outline-none focus:border-copper transition-colors resize-none"></textarea>
            </div>

            <Button type="submit" className="w-full">Send Project Details</Button>
            
            <p className="text-center text-xs text-muted mt-4">
              Your information is secure. We only use it to communicate regarding your project inquiry.
            </p>
          </form>
        </div>
      </Container>
    </section>
  );
}
