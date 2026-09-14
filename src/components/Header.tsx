import { useState, useEffect } from 'react';
import { Container } from './ui/Container';
import { Button } from './ui/Button';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Solutions', href: '#solutions' },
    { name: 'Industries', href: '#industries' },
    { name: 'Demos', href: '#demos' },
    { name: 'Why BriveXis', href: '#why-us' },
    { name: 'Process', href: '#process' },
    { name: 'About', href: '#about' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-midnight/95 backdrop-blur-md border-b border-dark-border py-4' : 'bg-midnight py-6'}`}>
      <Container>
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-5 h-5 bg-white rounded-sm relative overflow-hidden transition-transform group-hover:scale-105">
              <div className="absolute inset-0 bg-copper transform translate-y-2.5 -rotate-45"></div>
            </div>
            <span className="font-heading font-bold text-xl tracking-tight text-white">BriveXis</span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} className="text-sm font-medium text-muted-dark hover:text-white transition-colors">
                {link.name}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <Button>Discuss Your Project</Button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden text-white p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </Container>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-dark-surface border-b border-dark-border absolute w-full left-0 top-full">
          <div className="px-6 py-4 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                className="text-base font-medium text-white py-2 border-b border-dark-border/50"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-4 pb-2">
              <Button className="w-full">Discuss Your Project</Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
