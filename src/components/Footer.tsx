import { Container } from './ui/Container';

export function Footer() {
  const navLinks = [
    { name: 'Solutions', href: '#solutions' },
    { name: 'Industries', href: '#industries' },
    { name: 'Demos', href: '#demos' },
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' }
  ];

  return (
    <footer className="bg-midnight pt-20 pb-12 border-t border-dark-border">
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8 mb-16">
          <div className="md:col-span-5 lg:col-span-4">
            <div className="flex items-center gap-2 mb-6 group">
              <div className="w-5 h-5 bg-white rounded-sm relative overflow-hidden transition-transform group-hover:scale-105">
                <div className="absolute inset-0 bg-copper transform translate-y-2.5 -rotate-45"></div>
              </div>
              <span className="font-heading font-bold text-xl tracking-tight text-white">BriveXis</span>
            </div>
            <p className="text-muted-dark leading-relaxed max-w-sm mb-8">
              Custom business software built around real operations.
            </p>
          </div>
          
          <div className="md:col-span-3 lg:col-span-4">
            <h4 className="text-white font-bold mb-6 tracking-wide">Navigation</h4>
            <ul className="space-y-4">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-muted-dark hover:text-white transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="md:col-span-4 lg:col-span-4">
            <h4 className="text-white font-bold mb-6 tracking-wide">Location</h4>
            <p className="text-white mb-2 font-medium">Managua, Nicaragua</p>
            <p className="text-muted-dark leading-relaxed">
              Serving businesses across the U.S. and Latin America.
            </p>
          </div>
        </div>
        
        <div className="border-t border-dark-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-dark">
            &copy; {new Date().getFullYear()} BriveXis. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
