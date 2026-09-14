import { Container } from './ui/Container';
import { Button } from './ui/Button';
import { motion } from 'motion/react';

export function Hero() {
  return (
    <section className="relative bg-midnight pt-40 pb-24 lg:pt-52 lg:pb-32 overflow-hidden">
      {/* Subtle background texture/geometry */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-full border-l border-dark-border/50" />
        <div className="absolute top-1/2 left-0 w-full h-px bg-dark-border/50" />
        <div className="absolute right-1/4 top-0 w-px h-full bg-dark-border/30" />
        <div className="absolute bottom-1/4 left-1/4 w-px h-1/2 bg-dark-border/30" />
      </div>

      <Container className="relative z-10">
        <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-8"
          >
            Software built around <br className="hidden sm:block" />
            <span className="text-muted-dark">your business.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg sm:text-xl text-muted-dark max-w-2xl mb-12 leading-relaxed"
          >
            We design custom systems that replace spreadsheets, manual processes and disconnected tools with software built around the way your company actually operates.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Button className="w-full sm:w-auto">Discuss Your Project</Button>
            <Button variant="dark-outline" className="w-full sm:w-auto">Explore Our Solutions</Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mt-20 pt-8 border-t border-dark-border w-full max-w-3xl"
          >
            <p className="text-sm font-medium text-muted-dark tracking-widest uppercase">
              Custom business software &nbsp;&bull;&nbsp; Web platforms &nbsp;&bull;&nbsp; Internal systems &nbsp;&bull;&nbsp; Automation
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
