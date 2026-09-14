/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { WhoWeAre } from './components/WhoWeAre';
import { WhatWeSolve } from './components/WhatWeSolve';
import { WhyBriveXis } from './components/WhyBriveXis';
import { Solutions } from './components/Solutions';
import { Industries } from './components/Industries';
import { Demos } from './components/Demos';
import { Process } from './components/Process';
import { Nearshore } from './components/Nearshore';
import { ContactCTA } from './components/ContactCTA';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <div className="min-h-screen bg-ivory text-charcoal font-sans">
      <Header />
      <main>
        <Hero />
        <WhoWeAre />
        <WhatWeSolve />
        <WhyBriveXis />
        <Solutions />
        <Industries />
        <Demos />
        <Process />
        <Nearshore />
        <ContactCTA />
      </main>
      <Footer />
    </div>
  );
}
